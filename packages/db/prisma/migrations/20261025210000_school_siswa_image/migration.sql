-- Slot ke-2 karakter per sekolah (siswa/putra), terpisah dari siswi(characterImageUrl).
ALTER TABLE "SchoolSettings"
  ADD COLUMN IF NOT EXISTS "siswaImageUrl" TEXT;
