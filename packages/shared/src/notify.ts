import { z } from "zod";

// Kanal utama = in-app; WA sekunder (tanpa fallback kanal lain).
export interface MessageProvider {
  readonly name: string;
  send(to: string, text: string): Promise<{ ok: boolean; messageId?: string; error?: string }>;
  status(): Promise<{ connected: boolean; detail?: string }>;
}

export const notifySchema = z.object({
  userId: z.string().min(1).max(64).optional(), // kosong = broadcast sekolah (admin saja)
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(2000),
});

export const waSendSchema = z.object({
  to: z.string().trim().min(8).max(32),
  text: z.string().trim().min(1).max(4000),
  dedupeKey: z.string().trim().max(128).optional(),
});

// Normalisasi nomor ke format 62... (tanpa +, tanpa spasi).
export function normalizePhone(raw: string): string | null {
  let s = raw.replace(/[\s\-().]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("0")) s = `62${s.slice(1)}`;
  if (!/^62\d{8,14}$/.test(s)) return null;
  return s;
}

// Template pesan ({{nama}}, {{kelas}}, {{judul}}, {{deadline}}).
export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "");
}

export const DEFAULT_TEMPLATES = {
  alpha:
    "Yth. Bapak/Ibu, ananda {{nama}} ({{kelas}}) tercatat ALPHA hari ini ({{tanggal}}). Mohon konfirmasi ke wali kelas. Terima kasih.",
  reminder:
    "Ananda {{nama}}, tugas {{judul}} tenggat {{deadline}}. Segera kumpulkan sebelum terlambat.",
  thanks: "Terima kasih ananda {{nama}} sudah mengumpulkan tugas {{judul}} tepat waktu.",
};
