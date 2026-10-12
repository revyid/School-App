// F5: util markdown murni (tanpa React) — mudah diuji unit.
// closeUnbalancedMarkdown: menutup token yang belum berpasangan pada SALINAN
// teks yang dirender saat streaming, sehingga simbol mentah tidak pernah tampil.

/** Cek apalah string berisi html/link yang diizinkan same-origin. */
export const SAME_ORIGIN_PREFIXES = ["/api/assess-files/", "/api/task-files/", "/api/files/avatar/"];

export function isSafeInternalPath(href: string): boolean {
  if (!href.startsWith("/")) return false;
  // Path internal apa pun diizinkan untuk tautan, tapi media dibatasi prefix.
  return !href.startsWith("//");
}

export function isSafeMediaSrc(src: string): boolean {
  return SAME_ORIGIN_PREFIXES.some((p) => src.startsWith(p));
}

export function isSafeExternalUrl(href: string): boolean {
  try {
    const u = new URL(href);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Menutup token markdown yang belum berpasangan.
 * - `**tebal`, `*miring`, `` `kode ``, ```` ```blok ````, `[tautan` , `![img`
 * - dipanggil pada salinan teks, bukan teks sumber.
 */
export function closeUnbalancedMarkdown(text: string): string {
  let out = text;

  // Tutup blok kode ``` yang belum tertutup.
  const fences = (out.match(/```/g) ?? []).length;
  if (fences % 2 === 1) out += "\n```";

  // Tutup tautan/gambar yang dibuka tapi belum ditutup `]`.
  // (gambar lebih dulu agar `![alt` ikut tertangani)
  const linkOpens = (out.match(/!?\[/g) ?? []).length;
  const linkCloses = (out.match(/\]\(/g) ?? []).length;
  if (linkOpens > linkCloses) out += "](...)";

  // Tutup inline code ` yang ganjil.
  const backticks = (out.match(/(^|[^`])`([^`]|$)/g) ?? []).length;
  // pendekatan sederhana: hitung semua backtick tunggal
  const singles = (out.match(/`/g) ?? []).length;
  if (fences === 0 && singles % 2 === 1) out += "`";
  void backticks;

  // Tutup ** yang ganjil (jangan `*` tunggal — biarkan; renderernya aman).
  const bolds = (out.match(/\*\*/g) ?? []).length;
  if (bolds % 2 === 1) {
    // Hindari menambah ** tepat setelah ** yang menempel di akhir.
    if (!out.endsWith("**")) out += "**";
    else out += " **";
  }

  // Tutup * miring ganjil (di luar **).
  const stars = (out.match(/(?<!\*)\*(?!\*)/g) ?? []).length;
  if (stars % 2 === 1) out += "*";

  return out;
}

/**
 * Rapikan akhir jawaban saat finish_reason=length: potong di kalimat utuh terakhir,
 * tutup markdown yang belum selesai.
 */
export function tidyTruncated(text: string): string {
  const closed = closeUnbalancedMarkdown(text);
  const lastStop = Math.max(closed.lastIndexOf("."), closed.lastIndexOf("!"), closed.lastIndexOf("?"));
  // Potong di kalimat utuh terakhir bila posisinya >= 35% panjang teks
  // (di bawah itu kalimat pertama belum selesai — biarkan penuh + markdown ditutup).
  if (lastStop >= closed.length * 0.35) return closed.slice(0, lastStop + 1);
  return closed;
}
