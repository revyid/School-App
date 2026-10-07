# Doublecheck spec

## Goal
Mengadaptasi bahasa visual Edukids ke School-App pada Landing Portal Publik dan 3 Dasbor (Siswa, Guru, Admin) menggunakan aset kartun baru (PNG + WebP) sesuai SUPER PROMPT dengan mempertahankan keamanan, RLS, API, dan performa.

## Scope
Terdiri dari apps/web/public/assets/ (PNG + WebP), apps/web/app/globals.css, apps/web/app/(portal)/, apps/web/app/(dash)/, dan komponen UI terkait. Di luar scope: packages/db, packages/shared, packages/cli, apps/web/server, apps/web/app/api.

## Acceptance criteria
1. pnpm check, pnpm test, dan pnpm build lulus 100% tanpa error TypeScript/build/test.
2. Halaman Portal Publik (/) menggunakan hero 3-kolom dengan ilustrasi student-hero-transparent, section classroom dengan classroom-illustration, section bacaan dengan student-books, serta micro-doodles dekoratif.
3. Dasbor Siswa, Guru, dan Admin menggunakan aset ilustrasi baru yang relevan dengan perannya tanpa menutupi data atau teks penting.
4. Aset ilustrasi baru tersedia baik dalam format PNG asli/alias maupun WebP yang dioptimasi untuk bandwidth rendah.
5. Tampilan responsif pada breakpoint 390px, 768px, 1280px, dan 1440px tanpa horizontal scroll yang tidak disengaja.
6. Dukungan prefers-reduced-motion dan aksesibilitas (alt text, contrast ratio, keyboard focus) dipertahankan.

## Failure modes
1. Jika aset WebP gagal dimuat di browser lama, Next.js Image / browser fallback ke PNG.
2. Jika data API kosong, tampilkan empty state yang ramah (ajakan) dan bukan angka khayalan.
3. Jika prefers-reduced-motion aktif, matikan animasi floaty/breathe/drift.

## Priorities
Keamanan & kestabilan API/RLS > Responsif & aksesibilitas > Konsistensi Design System > Animasi & dekorasi visual.

## Non-goals
1. Tidak ada perubahan pada backend, Prisma DB schema, RLS policy, atau API routes server-side.
2. Tidak menggunakan foto anak nyata.
3. Tidak mengubah alur auth atau multi-tenant isolation.
