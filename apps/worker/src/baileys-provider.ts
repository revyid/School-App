// BaileysProvider per sekolah: sesi di <WA_ROOT>/<schoolId>/ (volume wa-sessions).
// Web TIDAK mengimpor file ini (hanya worker). Baileys sungguhan tidak diuji
// otomatis — cara uji manual ada di docs/wa-manual.md.
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import type { MessageProvider } from "@sms/shared/notify";

const waRoot = () => process.env.WA_SESSIONS_ROOT ?? "/data/wa-sessions";

interface Session {
  status: "connecting" | "open" | "closed";
  qr: string | null;
  sock: unknown;
  since: number; // timestamp ms mulai connecting — reset setelah QR/open
}

const sessions = new Map<string, Session>();
// Satu Promise per sekolah agar concurrent qr() tidak spawn socket ganda.
const pending = new Map<string, Promise<Session>>();

async function loadBaileys() {
  return import("@whiskeysockets/baileys");
}

export async function waDir(schoolId: string): Promise<string> {
  const dir = path.join(waRoot(), schoolId);
  await mkdir(dir, { recursive: true });
  const p = path.resolve(dir);
  if (!p.startsWith(path.resolve(waRoot()))) throw new Error("schoolId tidak valid");
  return dir;
}

const CONNECT_TIMEOUT_MS = 60_000;

async function spawnSession(schoolId: string): Promise<Session> {
  const dir = await waDir(schoolId);
  const sess: Session = { status: "connecting", qr: null, sock: null, since: Date.now() }; // since diisi di sini
  sessions.set(schoolId, sess);
  const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } =
    await loadBaileys();
  const { state, saveCreds } = await useMultiFileAuthState(dir);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined as never }));
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: ["sms-lms", "worker", "1.0"],
    connectTimeoutMs: 30_000,
  });
  sess.sock = sock;
  const ev = (sock as { ev: { on(e: string, f: (...a: unknown[]) => void): void } }).ev;
  ev.on("creds.update", saveCreds);
  ev.on("connection.update", (u: unknown) => {
    const upd = u as { connection?: string; qr?: string; lastDisconnect?: { error?: { output?: { statusCode?: number } } } };
    if (upd.qr) { sess.qr = upd.qr; sess.since = Date.now(); }
    if (upd.connection === "open") {
      sess.status = "open";
      sess.qr = null;
      pending.delete(schoolId);
    } else if (upd.connection === "close") {
      sess.status = "closed";
      sessions.delete(schoolId);
      pending.delete(schoolId);
      const code = upd.lastDisconnect?.error?.output?.statusCode;
      // Reconnect otomatis kecuali logout (401).
      if (code !== DisconnectReason?.loggedOut) {
        setTimeout(() => ensureSession(schoolId).catch(() => null), 5_000);
      }
    }
  });
  return sess;
}

async function ensureSession(schoolId: string): Promise<Session> {
  const cur = sessions.get(schoolId);
  if (cur && cur.status === "open") return cur;
  // Sesi sedang connecting dan belum timeout: pakai yang ada, jangan spawn baru.
  if (cur && cur.status === "connecting" && Date.now() - cur.since < CONNECT_TIMEOUT_MS) return cur;

  // Satu Promise per sekolah (debounce concurrent qr()).
  const existing = pending.get(schoolId);
  if (existing) return existing;

  const p = spawnSession(schoolId);
  pending.set(schoolId, p);
  p.catch(() => pending.delete(schoolId));
  return p;
}

export class BaileysProvider implements MessageProvider {
  readonly name = "baileys";
  constructor(private schoolId: string) {}

  async status() {
    const s = sessions.get(this.schoolId);
    if (!s || s.status === "closed") return { connected: false, detail: "putus" };
    if (s.status === "open") return { connected: true };
    return { connected: false, detail: "menghubungkan" };
  }

  async qr(): Promise<string | null> {
    await ensureSession(this.schoolId).catch(() => null);
    // Tunggu sebentar agar QR sempat diterima dari server WA.
    if (!sessions.get(this.schoolId)?.qr) {
      await new Promise((r) => setTimeout(r, 5_000));
    }
    return sessions.get(this.schoolId)?.qr ?? null;
  }

  async logout(): Promise<void> {
    const s = sessions.get(this.schoolId);
    const sock = s?.sock as { logout?: () => Promise<void> } | undefined;
    await sock?.logout?.().catch(() => {});
    sessions.delete(this.schoolId);
    pending.delete(this.schoolId);
  }

  async send(to: string, text: string) {
    const s = await ensureSession(this.schoolId).catch(() => null);
    if (!s || s.status !== "open") return { ok: false as const, error: "sesi WA belum terhubung" };
    const sock = s.sock as {
      sendMessage: (jid: string, m: { text: string }) => Promise<{ key?: { id?: string } }>;
    };
    const digits = to.replace(/\D/g, "");
    if (!digits) return { ok: false as const, error: "nomor tidak valid" };
    try {
      const r = await sock.sendMessage(`${digits}@s.whatsapp.net`, { text });
      return { ok: true as const, messageId: r.key?.id };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message.slice(0, 200) };
    }
  }
}

// Inisialisasi ulang semua sesi yang sudah tersimpan di disk saat worker boot
export async function initPersistedSessions(): Promise<void> {
  try {
    const root = waRoot();
    await mkdir(root, { recursive: true });
    const entries = await readdir(root, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.isDirectory()) {
        const schoolId = ent.name;
        ensureSession(schoolId).catch((err) =>
          console.error(`Gagal auto-reconnect WA session ${schoolId}:`, (err as Error).message)
        );
      }
    }
  } catch (err) {
    console.error("Gagal membaca folder waRoot:", (err as Error).message);
  }
}
