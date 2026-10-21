import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { hit } from "@/server/rate-limit";
import { db } from "@lacakedu/db/client";
import { runAsSchool } from "@lacakedu/db/tenant";
import { schoolSlugFromHost } from "@lacakedu/shared/school";
import { siteGuidePrompt, type PublicSiteInfo } from "@/server/ai-site-guide";
import { ipOf } from "@/server/request-ip";

const AI_ROUTER_BASE = process.env.AI_ROUTER_BASE || "https://9router.revy.my.id/v1";
const AI_ROUTER_KEY = process.env.AI_ROUTER_API_KEY || "";
const AI_MODEL = process.env.AI_ROUTER_MODEL || "oc/muse-spark-1.3-contributor-free";
const AI_CHAT_ENABLED = process.env.AI_CHAT_ENABLED === "true";
const apex = () => process.env.APEX_DOMAIN ?? "domainmu.id";

async function gate(req: NextRequest) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["SISWA", "GURU", "ADMIN"],
  });
}

// Anti-injection sanitizer sederhanakan prompt user
function sanitizeUserInput(text: string): string {
  if (!text) return "";
  let s = text.trim();
  if (s.length > 1000) s = s.slice(0, 1000);
  // Hilangkan percobaan override system prompt
  s = s.replace(/(system prompt|ignore previous instructions|abaikan instruksi sebelumnya|tampilkan kunci jawaban|bocorkan data)/gi, "[redacted]");
  return s;
}

async function askAI(
  systemPrompt: string,
  userMsg: string,
  maxTokens = 600,
  history: { role: "user" | "assistant"; content: string }[] = []
): Promise<string> {
  let lastErr = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const ctrl = new AbortController();
      // Timeout naik tiap percobaan (28s/36s/44s): model free-tier kadang butuh waktu muat.
      const timer = setTimeout(() => ctrl.abort(), 20000 + attempt * 8000);
      const aiRes = await fetch(`${AI_ROUTER_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AI_ROUTER_KEY}`,
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: userMsg },
          ],
          temperature: 0.3,
          max_tokens: maxTokens,
        }),
        signal: ctrl.signal,
      }).finally(() => clearTimeout(timer));
      if (aiRes.ok) {
        const raw = await aiRes.text().catch(() => "");
        let resJson: any = null;
        try {
          resJson = JSON.parse(raw);
        } catch {
          // Router kadang menempel trailer SSE ("data: [DONE]") setelah JSON.
          const cut = raw.split("data:")[0];
          const end = cut.lastIndexOf("}");
          if (end > 0) {
            try { resJson = JSON.parse(cut.slice(0, end + 1)); } catch { /* isi di bawah */ }
          }
        }
        const text = resJson?.choices?.[0]?.message?.content;
        if (typeof text === "string" && text.trim()) return text;
        lastErr = "empty-choices";
      } else {
        const bodyText = await aiRes.text().catch(() => "");
        lastErr = `router ${aiRes.status} ${bodyText.slice(0, 160)}`;
        // 4xx selain 429 = percuma retry (key salah / payload ditolak)
        if (aiRes.status < 500 && aiRes.status !== 429) break;
        await new Promise((r) => setTimeout(r, 600 * attempt));
      }
    } catch (e: any) {
      lastErr = e?.name === "AbortError" ? "timeout" : `network:${e?.cause?.message ?? e?.message ?? "unknown"}`;
      await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }
  console.error(`[ai-chat] router gagal 3x: ${lastErr} model=${AI_MODEL}`);
  throw new Error(lastErr || "router gagal");
}

// Varian stream (SSE): token diteruskan ke client apa adanya via onToken.
async function askAIStream(
  systemPrompt: string,
  userMsg: string,
  maxTokens = 600,
  history: { role: "user" | "assistant"; content: string }[] = [],
  onToken: (token: string) => void
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 55000);
  try {
    const aiRes = await fetch(`${AI_ROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_ROUTER_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
          { role: "user", content: userMsg },
        ],
        temperature: 0.3,
        max_tokens: maxTokens,
      }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));
    if (!aiRes.ok || !aiRes.body) {
      const t = await aiRes.text().catch(() => "");
      throw new Error(`router ${aiRes.status} ${t.slice(0, 120)}`);
    }
    const reader = aiRes.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let full = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const payload = t.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const j = JSON.parse(payload);
          const delta: unknown =
            j?.choices?.[0]?.delta?.content ?? j?.choices?.[0]?.message?.content ?? "";
          if (typeof delta === "string" && delta) {
            full += delta;
            onToken(delta);
          }
        } catch {
          // Potongan SSE tak lengkap — abaikan, lanjut baca.
        }
      }
    }
    if (!full.trim()) throw new Error("empty-choices");
    return full;
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("timeout");
    throw e instanceof Error ? e : new Error("router gagal");
  }
}

// Bungkus generator stream jadi Response SSE + simpan hasil akhir.
function streamReply(
  run: (send: (token: string) => void) => Promise<string>,
  save: (full: string) => Promise<void>
) {
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (token: string) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ token })}\n\n`));
      try {
        const full = await run(send);
        await save(full).catch(() => {});
        controller.enqueue(enc.encode("data: [DONE]\n\n"));
      } catch (e: any) {
        const h = honestError(String(e?.message ?? ""));
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ error: h.error })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!AI_CHAT_ENABLED) return NextResponse.json({ enabled: false, messages: [] });
  const a = await gate(req);
  if (a.ok && a.school) {
    const messages = await runAsSchool(db, a.school.id, async (tx) => {
      const settings = await tx.schoolSettings.findUnique({
        where: { schoolId: a.school.id },
        select: { aiChatEnabled: true },
      });
      if (!settings?.aiChatEnabled) return null;
      const sess = await tx.aiChatSession.findUnique({
        where: { schoolId_userId: { schoolId: a.school.id, userId: a.userId } },
        select: { id: true },
      });
      if (!sess) return [];
      return tx.aiChatMessage.findMany({
        where: { sessionId: sess.id },
        select: { role: true, content: true, createdAt: true },
        orderBy: { createdAt: "asc" },
        take: 50,
      });
    });
    if (messages === null) return NextResponse.json({ enabled: false, messages: [] });
    return NextResponse.json({
      enabled: true,
      messages: messages.map((r) => ({ sender: r.role === "user" ? "user" : "ai", text: r.content })),
    });
  }

  const slug = schoolSlugFromHost(req.headers.get("host") ?? "", apex());
  if (!slug) return NextResponse.json({ enabled: false, messages: [] });
  const school = await db.school.findFirst({ where: { slug }, select: { id: true } });
  if (!school) return NextResponse.json({ enabled: false, messages: [] });
  const settings = await runAsSchool(db, school.id, (tx) =>
    tx.schoolSettings.findUnique({ where: { schoolId: school.id }, select: { aiChatEnabled: true } }),
  );
  return NextResponse.json({ enabled: settings?.aiChatEnabled ?? false, messages: [] });
}

// DELETE /api/ai/chat — bersihkan riwayat chat AI milik user ini sendiri.
export async function DELETE(req: NextRequest) {
  const a = await gate(req);
  if (!a.ok || !a.school) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await runAsSchool(db, a.school.id, async (tx) => {
    const sess = await tx.aiChatSession.findUnique({
      where: { schoolId_userId: { schoolId: a.school.id, userId: a.userId } },
      select: { id: true },
    });
    if (!sess) return;
    await tx.aiChatMessage.deleteMany({ where: { sessionId: sess.id } });
  });
  return NextResponse.json({ ok: true });
}

async function getOrCreateSession(schoolId: string, userId: string) {
  return runAsSchool(db, schoolId, (tx) =>
    tx.aiChatSession.upsert({
      where: { schoolId_userId: { schoolId, userId } },
      update: {},
      create: { schoolId, userId },
      select: { id: true },
    }));
}

async function saveMsg(schoolId: string, sessionId: string, role: "user" | "assistant", content: string) {
  await runAsSchool(db, schoolId, async (tx) => {
    await tx.aiChatMessage.create({ data: { schoolId, sessionId, role, content: content.slice(0, 4000) } });
    const count = await tx.aiChatMessage.count({ where: { sessionId } });
    if (count > 50) {
      const old = await tx.aiChatMessage.findMany({
        where: { sessionId }, select: { id: true },
        orderBy: { createdAt: "asc" }, take: count - 50,
      });
      await tx.aiChatMessage.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    }
  });
}

// Riwayat singkat (5 pasang terakhir) sebagai konteks lanjutan percakapan
async function recentHistory(schoolId: string, sessionId: string) {
  const rows = await runAsSchool(db, schoolId, (tx) =>
    tx.aiChatMessage.findMany({
      where: { sessionId },
      select: { role: true, content: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }));
  return rows.reverse().map((r) => ({
    role: r.role === "user" ? ("user" as const) : ("assistant" as const),
    content: r.content.slice(0, 800),
  }));
}

// Info PUBLIK sekolah saja (agregat + pengumuman target ALL). Tanpa data pribadi siapa pun.
async function publicSiteInfo(schoolId: string, schoolName: string): Promise<PublicSiteInfo> {
  return runAsSchool(db, schoolId, async (tx) => {
    const now = new Date();
    const s = await tx.schoolSettings.findUnique({ where: { schoolId } });
    const announcements = await tx.announcement.findMany({
      where: { target: "ALL", publishAt: { lte: now } },
      select: { title: true, body: true },
      take: 5,
      orderBy: { publishAt: "desc" },
    });
    const [students, teachers, classes, subjects] = await Promise.all([
      tx.studentProfile.count(),
      tx.user.count({ where: { role: "GURU", isActive: true } }),
      tx.class.count(),
      tx.subject.findMany({ select: { name: true }, orderBy: { name: "asc" }, take: 8 }),
    ]);
    return {
      portalName: s?.portalName || schoolName,
      studentCount: students,
      teacherCount: teachers,
      classCount: classes,
      subjects: subjects.map((x) => x.name),
      announcements: announcements.map((an) => ({ judul: an.title, isi: an.body.slice(0, 200) })),
    };
  });
}

function honestError(kind: string): { error: string; status: number } {
  if (kind.includes("429"))
    return { error: "RAI sedang penuh. Tunggu ±1 menit lalu coba lagi.", status: 502 };
  if (kind === "timeout")
    return { error: "RAI lambat merespons. Coba pertanyaan yang lebih pendek.", status: 504 };
  if (kind.includes("empty-choices"))
    return { error: "RAI belum bisa menjawab. Coba lagi sebentar.", status: 502 };
  if (kind.includes("401") || kind.includes("403"))
    return { error: "Layanan RAI sedang bermasalah. Hubungi admin.", status: 502 };
  return { error: "RAI gagal merespons. Coba lagi sebentar.", status: 502 };
}

export async function POST(req: NextRequest) {
  if (!AI_CHAT_ENABLED) {
    return NextResponse.json({ error: "RAI dinonaktifkan oleh konfigurasi layanan." }, { status: 503 });
  }
  const body = await req.json().catch(() => null);
  const userMsgRaw = typeof body?.message === "string" ? body.message : "";
  const userMsg = sanitizeUserInput(userMsgRaw);

  if (!userMsg) {
    return NextResponse.json({ error: "Pesan tidak boleh kosong" }, { status: 400 });
  }

  if (!AI_ROUTER_KEY) {
    return NextResponse.json(
      { error: "RAI belum diaktifkan di server ini. Hubungi admin." },
      { status: 503 }
    );
  }

  const a = await gate(req);

  // ---- Mode login: HANYA data milik user ini + data publik sekolah ----
  if (a.ok && a.school) {
    // Rate-limit: maks 20 pesan per jam per user login
    const rl = await hit(`rl:ai:${a.school.id}:${a.userId}`, 20, 3600);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Batas pesan RAI tercapai (maks 20 pesan/jam). Coba lagi nanti." },
        { status: 429 }
      );
    }

  const aiSettings = await runAsSchool(db, a.school.id, (tx) =>
    tx.schoolSettings.findUnique({
      where: { schoolId: a.school.id },
      select: { aiChatEnabled: true },
    }),
  );
  if (!aiSettings?.aiChatEnabled) {
    return NextResponse.json({ error: "RAI belum diaktifkan administrator sekolah." }, { status: 503 });
  }

  // AI tahu SELURUH website (panduan per peran + info publik) tapi TIDAK PERNAH baca data pribadi:
  // tanpa profil, tugas, nilai, kehadiran, pengumpulan, atau pengumuman non-publik siapa pun.
  const pub = await publicSiteInfo(a.school.id, a.school.name);
  const systemPrompt = siteGuidePrompt(pub, a.role);
  const sess0 = await getOrCreateSession(a.school.id, a.userId);
  const hist = await recentHistory(a.school.id, sess0.id);
  const wantsStream = new URL(req.url).searchParams.get("stream") === "1";
  if (wantsStream) {
    return streamReply(
      (send) => askAIStream(systemPrompt, userMsg, 600, hist, send),
      async (full) => {
        const sess = await getOrCreateSession(a.school.id, a.userId);
        await saveMsg(a.school.id, sess.id, "user", userMsg).catch(() => {});
        await saveMsg(a.school.id, sess.id, "assistant", full).catch(() => {});
      }
    );
  }
  try {
    const sess = await getOrCreateSession(a.school.id, a.userId);
    const reply = await askAI(systemPrompt, userMsg, 600, hist);
    await saveMsg(a.school.id, sess.id, "user", userMsg).catch(() => {});
    await saveMsg(a.school.id, sess.id, "assistant", reply).catch(() => {});
    return NextResponse.json({ reply, mode: "general" });
  } catch (e: any) {
    const h = honestError(String(e?.message ?? ""));
    return NextResponse.json({ error: h.error }, { status: h.status });
  }
  }

  // ---- Mode tamu (publik, tanpa login): HANYA info publik sekolah ----
  const host = req.headers.get("host") ?? "";
  const slug = schoolSlugFromHost(host, apex());
  if (!slug) return NextResponse.json({ error: "Sekolah tidak ditemukan" }, { status: 404 });
  const school = await db.school.findFirst({ where: { slug }, select: { id: true, name: true } });
  if (!school) return NextResponse.json({ error: "Sekolah tidak ditemukan" }, { status: 404 });

  const guestSettings = await runAsSchool(db, school.id, (tx) =>
    tx.schoolSettings.findUnique({ where: { schoolId: school.id }, select: { aiChatEnabled: true } }),
  );
  if (!guestSettings?.aiChatEnabled) {
    return NextResponse.json({ error: "RAI belum diaktifkan administrator sekolah." }, { status: 503 });
  }

  const ip = ipOf(req);
  const rlG = await hit(`rl:ai:guest:${school.id}:${ip}`, 10, 3600);
  if (!rlG.ok) {
    return NextResponse.json(
      { error: "Batas pesan AI tamu tercapai (maks 10 pesan/jam). Coba lagi nanti." },
      { status: 429 }
    );
  }
  // Kuota harian per sekolah: XFF bisa dipalsukan/rotasi, jadi batas per-IP di atas
  // saja tidak cukup. 300/hari = ~30 tamu wajar x 10 pesan, masih aman untuk biaya AI.
  const rlSchool = await hit(`rl:ai:guest:${school.id}`, 300, 86400);
  if (!rlSchool.ok) {
    return NextResponse.json(
      { error: "Kuota pesan AI tamu sekolah ini habis untuk hari ini. Coba lagi besok." },
      { status: 429 }
    );
  }

  const pub = await publicSiteInfo(school.id, school.name);
  const guestPrompt = siteGuidePrompt({ ...pub, announcements: pub.announcements }, "TAMU");

  try {
    const reply = await askAI(guestPrompt, userMsg);
    return NextResponse.json({ reply, mode: "guest" });
  } catch (e: any) {
    const h = honestError(String(e?.message ?? ""));
    return NextResponse.json({ error: h.error }, { status: h.status });
  }
}
