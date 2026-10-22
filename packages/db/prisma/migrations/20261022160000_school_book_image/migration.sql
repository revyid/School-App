-- Fase 5: slot gambar yang bisa diganti per sekolah.
--   characterImageUrl -> ilustrasi karakter (student-hero-transparent)
--   bookImageUrl     -> ilustrasi buku      (student-book)
--   heroImageUrl     -> ilustrasi ruang kelas (classroom-illustration)
--   dashboardBannerUrl -> banner tambahan dashboard (opsional)
ALTER TABLE "SchoolSettings"
  ADD COLUMN IF NOT EXISTS "bookImageUrl" TEXT;
