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
  // T7: 3 tahap pengingat WA ortu (D7) — sopan, sebut nama anak, judul, tenggat WIB, tautan masuk.
  stageD1:
    "Yth. Bapak/Ibu, mohon bantuan mengingatkan ananda {{nama}}: tugas \"{{judul}}\" berbatas {{deadline}} WIB (kurang dari 24 jam). Ananda dapat masuk melalui aplikasi sekolah untuk mengumpulkan. Terima kasih.",
  stageH3:
    "Yth. Bapak/Ibu, pengingat terakhir: tugas \"{{judul}}\" ananda {{nama}} berbatas {{deadline}} WIB (kurang dari 3 jam). Mohon dampingi agar segera dikumpulkan. Terima kasih.",
  stageOver:
    "Yth. Bapak/Ibu, tenggat tugas \"{{judul}}\" ananda {{nama}} telah lewat ({{deadline}} WIB). Bila ada kendala, mohon hubungi guru pengampu. Terima kasih.",
  groupNudge:
    "Yth. Bapak/Ibu, tugas \"{{judul}}\" ananda {{nama}} adalah tugas kelompok yang berbatas {{deadline}} WIB, namun kelompoknya belum terbentuk. Mohon bantuan agar ananda segera membentuk kelompok di aplikasi. Terima kasih.",
};

// Format tanggal-tenggat ramah WIB: "Senin, 12 Okt 2026 pukul 23.59".
export function formatDeadlineId(deadline: Date, timezone = "Asia/Jakarta"): string {
  const s = new Intl.DateTimeFormat("id-ID", {
    weekday: "long", day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: timezone,
  }).format(deadline);
  // id-ID memakai titik pemisah menit (23.59) → rapikan ke 23:59.
  return s.replace(/(\d{2})\.(\d{2})$/, "$1:$2") + " WIB";
}
