import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { questionInputSchema } from "@sms/shared/assess";
import { saveAssessImg } from "@/server/assess-files";

async function gate(req: NextRequest, roles: ("ADMIN" | "GURU")[]) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles,
  });
}

// GET /api/questions?subjectId= — bank soal milik guru ini (ADMIN: semua). TANPA kunci.
export async function GET(req: NextRequest) {
  const a = await gate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const subjectId = new URL(req.url).searchParams.get("subjectId");
  const where: { authorId?: string; subjectId?: string } = {};
  if (a.role === "GURU") where.authorId = a.userId;
  if (subjectId) where.subjectId = subjectId.slice(0, 64);
  const rows = await runAsSchool(db, a.school.id, (tx) =>
    tx.question.findMany({
      where,
      select: { id: true, subjectId: true, type: true, stem: true, imageName: true, options: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }));
  return NextResponse.json({ rows });
}

// POST /api/questions (multipart: fields + image?) — simpan ke bank. Kunci ikut tersimpan tapi tak dikembalikan.
export async function POST(req: NextRequest) {
  const a = await gate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const ctype = req.headers.get("content-type") ?? "";
  if (!ctype.includes("multipart/form-data")) {
    return NextResponse.json({ error: "gunakan form" }, { status: 400 });
  }
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "form tidak valid" }, { status: 400 });
  let opts: string[] = [];
  try {
    opts = JSON.parse(String(form.get("options") ?? "[]"));
  } catch {
    return NextResponse.json({ error: "options harus JSON array" }, { status: 400 });
  }
  const ci = String(form.get("correctIndex") ?? "");
  const parsed = questionInputSchema.safeParse({
    subjectId: form.get("subjectId") ? String(form.get("subjectId")) : null,
    type: String(form.get("type") ?? "MCQ"),
    stem: String(form.get("stem") ?? ""),
    options: opts,
    correctIndex: ci === "" ? null : Number(ci),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "input tidak valid", detail: parsed.error.issues[0]?.message }, { status: 400 });
  }
  const f = form.get("image");
  let imageName: string | null = null;
  if (f && typeof f !== "string") {
    try {
      imageName = await saveAssessImg(a.school.id, Buffer.from(await f.arrayBuffer()));
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
  }
  const v = parsed.data;
  const row = await runAsSchool(db, a.school.id, (tx) =>
    tx.question.create({
      data: {
        schoolId: a.school.id,
        subjectId: v.subjectId || null,
        authorId: a.userId,
        type: v.type,
        stem: v.stem,
        imageName,
        options: v.options,
        correctIndex: v.type === "MCQ" ? (v.correctIndex ?? 0) : null,
        correctOrder: v.type === "SORTING" ? v.options.map((_, i) => i) : [],
      },
    }));
  await logAuth(a.school.id, "QUESTION.CREATE", { actorId: a.userId, meta: { id: row.id } });
  const { correctIndex: _k, correctOrder: _o, ...safe } = row;
  return NextResponse.json({ question: safe }, { status: 201 });
}
