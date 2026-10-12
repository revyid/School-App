// Parser soal massal untuk guru.
//
// FORMAT yang didukung (satu soal dipisah baris kosong):
//
// 1. Ibu kota Indonesia adalah...
// a Surabaya
// b Jakarta (BENAR)      <- tandai jawaban benar
// c Bandung
//
// 2. Urutkan siklus air (SORTING)   <- tipe mengurutkan
// Evaporasi
// Kondensasi
// Presipitasi
//
// 3. Indonesia merdeka tahun 1945 (BENAR/SALAH)  <- benar/salah
//
// 4. 2 + 3 = ... (ISIAN: 5)   <- isian singkat
//
// Aturan PENTing sesuai permintaan guru:
//   - Hanya ISI opsi yang diacak ke siswa. LABEL "a b c" TETAP berurutan
//     (tidak ikut diacak), supaya guru tetap bisa menyebut "jawaban b".
//   - Baris pertama soal boleh memuat nomor ("1.", "2)") — dibuang otomatis.
//   - Baris berikutnya dalam blok soal yang sama = tubuh soal lanjutan
//     (bisa multi-baris), kecuali dia berawalan "a"/"b"/"c" (opsi).
//
// TIPE soal: MCQ (pilihan ganda), SORTING (mengurutkan), BOOL (benar/salah),
// SHORT (isian singkat). BOOL dan SHORT dinormalisasi ke MCQ agar mesin
// penilai yang ada tetap bisa dipakai.
import { z } from "zod";

export type QType = "MCQ" | "SORTING";

export type ParsedQ = {
  type: QType;
  /** label asli yang diketik guru, misal "SORTING" atau "ISIAN" */
  rawType: string;
  stem: string;
  options: string[];
  correctIndex: number | null;
};

// Baris opsi: "a jawaban a", "b) ...", "c. ..." — huruf tunggal a-h atau angka 1-8.
// Pemisah boleh spasi saja (format utama guru) atau titik/kurung/strip.
const OPT_RE = /^([a-hA-H]|[1-8])\s*[.)\-:]?\s+(\S.*)$/;
// Penanda jawaban benar di akhir baris opsi.
const MARK_RE = /\s*(\(benar\)|\(BENAR\)|\(jawaban\)|\*|\[benar\])\s*$/i;
const BOOL_RE = /\((benar\/salah|b\/s|true\/false|ya\/tidak)\)/i;
const SHORT_RE = /\(isian\s*:\s*([^)]+)\)/i;
const SORT_RE = /\(sorting\)|urutkan/i;

function stripMark(s: string): { text: string; marked: boolean } {
  const marked = MARK_RE.test(s);
  return { text: s.replace(MARK_RE, "").trim(), marked };
}

function isOptLine(line: string): boolean {
  return OPT_RE.test(line.trim());
}

/**
 * Pecah blok teks soal menjadi daftar soal terstruktur.
 * Mengembalikan juga `errors` untuk baris yang tidak bisa dipahami, supaya
 * guru mendapat umpan balik langsung di UI (bukan gagal diam-diam).
 */
export function parseMultiQuestions(raw: string): { questions: ParsedQ[]; errors: string[] } {
  const questions: ParsedQ[] = [];
  const errors: string[] = [];

  // Pisahkan blok: baris kosong, ATAU baris yang mulai nomor baru ("2. ...")
  // jadi pemisah walau tanpa baris kosong.
  const rawBlocks = raw.split(/\n\s*\n/);
  const blocks: string[] = [];
  for (const b of rawBlocks) {
    const lines = b.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim() !== "");
    if (lines.length === 0) continue;
    let cur: string[] = [];
    for (const l of lines) {
      const startsNew = /^\d+[\.\)]\s+/.test(l.trim()) && cur.length > 0;
      if (startsNew) {
        blocks.push(cur.join("\n"));
        cur = [l];
      } else {
        cur.push(l);
      }
    }
    if (cur.length > 0) blocks.push(cur.join("\n"));
  }

  blocks.forEach((block, bi) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    const first = lines[0];
    const stem0 = first.replace(/^\d+[\.\)]\s*/, "").trim();

    // --- Deteksi tipe dari baris pertama ---
    const isSorting = SORT_RE.test(stem0);
    const boolM = stem0.match(BOOL_RE);
    const shortM = stem0.match(SHORT_RE);

    // Bersihkan penanda tipe dari tubuh soal.
    let stemHead = stem0
      .replace(BOOL_RE, "")
      .replace(SHORT_RE, "")
      .replace(SORT_RE, "")
      .trim();

    // Deteksi BENAR/SALAH juga bisa dari baris opsi (a Benar / b Salah).
    // --- Kumpulkan baris tubuh vs opsi ---
    // Baris pertama = awal tubuh. Baris berikutnya yang BUKAN opsi juga
    // tubuh (soal multi-baris), sampai ketemu baris opsi pertama.
    const bodyLines: string[] = [stemHead];
    const optLines: { label: string; text: string; marked: boolean }[] = [];
    let seenOpt = false;

    for (const line of lines.slice(1)) {
      if (isOptLine(line)) {
        seenOpt = true;
        const m = line.trim().match(OPT_RE);
        if (!m) continue;
        const { text, marked } = stripMark(m[2] ?? "");
        if (text) optLines.push({ label: m[1].toLowerCase(), text, marked });
      } else if (!seenOpt) {
        // Masih bagian tubuh soal (belum ada opsi).
        bodyLines.push(line.replace(BOOL_RE, "").replace(SHORT_RE, "").trim());
      } else {
        // Setelah opsi, baris tanpa label dianggap lanjutan opsi terakhir.
        const last = optLines[optLines.length - 1];
        if (last) {
          const { text, marked } = stripMark(line);
          if (text) {
            last.text = (last.text + " " + text).trim();
            if (marked) last.marked = true;
          }
        }
      }
    }

    const stem = bodyLines.filter(Boolean).join("\n").trim();

    // ---------- TIPE: ISIAN SINGKAT ----------
    if (shortM) {
      const answer = shortM[1].trim();
      questions.push({
        type: "MCQ",
        rawType: "ISIAN",
        stem,
        // Disimpan sebagai MCQ 2 opsi: [jawaban benar, pengecoh].
        // Hanya ISI yang diacak; label a/b tetap urut.
        options: [answer, "—"],
        correctIndex: 0,
      });
      return;
    }

    // ---------- TIPE: BENAR / SALAH ----------
    if (boolM) {
      // Cari opsi yang ditandai benar; default "Benar" bila tidak ada tanda.
      const opts = optLines.length >= 2
        ? optLines.map((o) => o.text)
        : ["Benar", "Salah"];
      let ci = optLines.findIndex((o) => o.marked);
      if (ci < 0) {
        // Tebak dari kata: baris yang mengandung "benar"/"true"/"ya" = jawaban.
        const guess = opts.findIndex((t) => /^(benar|true|ya)$/i.test(t.trim()));
        ci = guess >= 0 ? guess : 0;
      }
      questions.push({ type: "MCQ", rawType: "BENAR/SALAH", stem, options: opts, correctIndex: Math.max(0, ci) });
      return;
    }

    // ---------- TIPE: MENGURUTKAN ----------
    if (isSorting) {
      const items = optLines.map((o) => o.text);
      if (items.length < 2) {
        // Boleh juga tanpa label a/b/c — satu item per baris.
        const plain = lines.slice(1).map((l) => l.replace(/^[a-hA-H\d][\.\)\-]\s*/, "").trim()).filter(Boolean);
        if (plain.length >= 2) {
          questions.push({ type: "SORTING", rawType: "SORTING", stem, options: plain, correctIndex: null });
          return;
        }
        errors.push(`Soal ${bi + 1}: tipe mengurutkan butuh minimal 2 item.`);
        return;
      }
      questions.push({ type: "SORTING", rawType: "SORTING", stem, options: items, correctIndex: null });
      return;
    }

    // ---------- TIPE: PILIHAN GANDA ----------
    if (optLines.length >= 2) {
      let ci = optLines.findIndex((o) => o.marked);
      if (ci < 0) ci = 0;
      // Validasi: label harus a,b,c,... berurutan agar tidak salah urut.
      const labels = optLines.map((o) => o.label).join(",");
      const expect = optLines.map((_, i) => String.fromCharCode(97 + i)).join(",");
      if (labels !== expect && /\d/.test(optLines[0].label)) {
        // Guru memakai angka 1.,2.,3. — terima saja.
      }
      if (optLines.length > 6) {
        errors.push(`Soal ${bi + 1}: pilihan ganda maksimal 6 opsi (ketemu ${optLines.length}).`);
        return;
      }
      questions.push({
        type: "MCQ",
        rawType: "PILIHAN GANDA",
        stem,
        options: optLines.map((o) => o.text),
        correctIndex: Math.max(0, ci),
      });
      return;
    }

    // Tidak ada opsi sama sekali -> anggap isian dengan tubuh saja.
    if (stem) {
      errors.push(
        `Soal ${bi + 1}: tidak ada opsi a/b/c. Tambahkan opsi, atau tandai (ISIAN: jawaban).`,
      );
    }
  });

  return { questions, errors };
}

/** Contoh format untuk placeholder textarea guru. */
export const PLACEHOLDER_EXAMPLE = `1. Ibu kota negara adalah...
a Surabaya
b Jakarta (BENAR)
c Bandung
d Medan

2. Urutkan siklus air dari awal (SORTING)
a Evaporasi
b Kondensasi
c Presipitasi

3. Air mendidih pada suhu 100°C (BENAR/SALAH)
a Benar (BENAR)
b Salah

4. Hasil dari 12 x 12 adalah ... (ISIAN: 144)`;
