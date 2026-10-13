# SMS-LMS — Full-scan UX, fitur, dan fix bug (siswa/guru/admin/navigasi/login/landing)

Goal: Selesaikan semua request UX/fitur/bug landing, dashboard siswa, guru, admin, navigasi, dan login dalam satu batch terverifikasi tanpa regresi.

## 1. Current context / assumptions

- Repo: `~/Projects/me/sms-lms`, web: `~/Projects/me/sms-lms/apps/web` (Next.js 16 + Prisma + Postgres RLS + Redis, multi-tenant subdomain).
- File kunci (sudah dibaca, jangan tebak ulang):
  - Landing: `apps/web/app/(portal)/page.tsx` (hero, `#tentang`, `#program` trio "Kecil-kecil berani besar" line ~194-226, `#mapel` "Satu tempat seribu kemungkinan" line ~228-263, fallback mapel line 247).
  - Siswa dashboard: `apps/web/app/(dash)/siswa/dashboard.tsx` (metrik "Menunggu dikerjakan" line 95-103, "Lencana" line 111-119, bawah "Tugas menunggu" + "Lencanaku").
  - Menu global: `apps/web/app/(dash)/layout.tsx` (`MENUS` SISWA/GURU/ADMIN).
  - Shell: `apps/web/components/DashShell.tsx` (burger line 154, avatar+username line 174-190, sidebar desktop line 132).
  - Bell: `apps/web/components/Bell.tsx` (toggle inbox line 297-336, `BellInbox` line 382-509, push `subscribePush` line 82-128).
  - Push API: `apps/web/app/api/push/subscribe/route.ts`, `apps/web/app/api/push/test/route.ts`, `apps/web/app/api/push/vapid-public/route.ts`.
  - Guru tugas list: `apps/web/app/(dash)/guru/tugas/page.tsx`; buat tugas: `apps/web/app/(dash)/guru/tugas/new/page.tsx` (single `classId` line 53).
  - Scanner: `apps/web/app/(dash)/guru/scanner/page.tsx` (regex token `/^sms1-[0-9a-f]{32}$/` line 221); kamera: `apps/web/components/useCamera.ts`.
  - WA admin: `apps/web/app/(dash)/admin/wa/page.tsx`; status proxy: `apps/web/app/api/wa/status/route.ts`; worker: `apps/worker/src/wa-queue.ts`, `baileys-provider.ts`.
  - Jadwal admin: `apps/web/app/(dash)/admin/jadwal/page.tsx`; API: `apps/web/app/api/timetable/route.ts` (GET ADMIN/GURU, POST/PUT/DELETE ADMIN-only).
  - Mapel admin: `apps/web/app/(dash)/admin/mapel/page.tsx`; import siswa: `apps/web/app/(dash)/admin/import/page.tsx`.
  - Login: `apps/web/app/login/page.tsx` (password input line 152-155, tanpa toggle).
  - Kata "sejarah/Indonesia" tersebar di: `app/buku/BukuClient.tsx`, `app/api/portal/popular-books/route.ts`, `app/api/portal/search-books/route.ts`, `app/(portal)/page.tsx:247` ("Bahasa Indonesia"), `app/privasi/page.tsx` (UU RI — ini legal, JANGAN diubah), `lib/parse-questions.ts` (contoh placeholder).
- Keputusan user (hasil klarifikasi, JANGAN tanya ulang):
  - Landing: hapus seluruh `<section id="program">` dan `<section id="mapel">`, bukan cuma heading.
  - Siswa: hapus 2 kartu metrik saja; blok bawah "Tugas menunggu/Lencanaku" TETAP ("biarin").
  - Siswa navbar: Tugas/Asesmen/Kartu HAPUS TOTAL, direct-URL lama WAJIB redirect ke Kelasku.
  - Kelasku = card per mapel + badge gabungan (judul, guru, jadwal mingguan; badge lingkaran = tugas+asesmen belum; klik card → daftar tugas/asesmen mapel itu).
  - Guru: SATU page tab Tugas|Asesmen + data SHARED antar kelas (bukan duplikat): judul/instruksi shared (edit di mana saja berlaku semua kelas); deadline + jadwal tampil (publishAt) PER KELAS; nilai/pengumpulan per kelas terpisah; hapus = dialog 3 pilihan (kelas ini saja / semua kelas / batal). → Butuh model join + migrasi Prisma (lihat 0.1).
  - Jadwal admin: edit via dialog + export/import xlsx kolom Hari|Mulai|Selesai|Mapel|Guru; Mapel jadi redirect ke Jadwal.
  - QR: Android Brave, https demo.revy.my.id, kamera NYALA tapi nol interaksi saat diarahkan ke QR dashboard siswa → fokus: BarcodeDetector absen di Brave + isi QR dashboard mungkin bukan token mentah.
  - WA: tombol "Kirim pengingat WA ke orang tua" di detail tugas → "WA masuk antrean: 0", histori admin kosong, status Terhubung. Fokus: kenapa nudge menghitung 0 + tak ada row outbox. (Request "notifikasi peringatan guru di admin" DITARIK user — jangan kerjakan.)
  - Bell: klik lonceng ke-2 = kedip tutup-buka (bukan tutup). Push ON → "Server menolak subscription (500: coba login ulang)". Dua bug terpisah.

## 2. Architecture / proposed approach

- Fase 0: full-scan baca-saja (audit UX + inventaris bug + petakan skema DB) sebelum ubah apa pun.
- Implementasi per area vertikal (landing → siswa → guru → admin → navigasi → login), tiap task TDD kecil + commit kecil.
- Perubahan API mengikuti pola existing: `requireRole` gate + `runAsSchool(db, school.id, tx => ...)` + `logAuth` untuk mutasi admin. Jangan tambah pola baru.

## 3. Step-by-step tasks

### FASE 0 — Full scan (read-only, ~30 mnt)

- [ ] **0.1 Petakan skema DB — KRITIS untuk shared model.** Baca `packages/db/prisma/schema.prisma` model `Task`, `Assessment`, `Submission`, `Grade`. Keputusan user menuntut SHARED: satu tugas/asesmen → banyak kelas; judul/instruksi shared; deadline+publishAt PER KELAS; nilai per kelas terpisah; hapus per-kelas-atau-semua. Rancang: tabel induk (`Task`: judul, instruksi, subject, type, kategori) + tabel join per-kelas (`TaskTarget`: taskId, classId, deadline, publishAt, allowLate, status) + submission/grade tetap per siswa (otomatis per-kelas via enrolment). Migrasi backfill: tiap Task existing → 1 TaskTarget dari field lama, lalu drop kolom lama. Alternatif tanpa migrasi (kolom `groupId` shared + override per-row) hanya bila migrasi terbukti terlalu berisiko — catat keputusan di plan.
  - Verify: `grep -n "model Task\|model Assessment\|model TimetableSlot\|model PushSubscription" packages/db/prisma/schema.prisma` → harus ketemu 4 model.
- [ ] **0.2 Audit QR — FOKUS: Brave Android + QR dashboard siswa.** (a) Baca `app/(dash)/siswa/kartu/page.tsx` + dashboard siswa: QR di sana render ISI APA — token mentah `sms1-...` atau URL/JSON? Bila bukan token mentah, scanner takkan pernah match — itu bug #1. (b) Brave Android: `window.BarcodeDetector` TIDAK ADA di Brave (dikenal tidak diekspos) → loop `if (!BD) continue` diam selamanya = "nol interaksi". Fix wajib: fallback decoder `jsqr` dari frame video (lazy import). (c) Kamera nyala via HTTPS jadi `useCamera` OK. (d) Cek juga `version`/rotasi token: QR lama di dashboard vs token aktif di DB.
- [ ] **0.3 Audit WA — FOKUS: nudge hitung 0.** Baca `app/api/tasks/[id]/nudge/route.ts` (atau sejenis): kenapa `waQueued: 0` padahal siswa punya nomor ortu + status Terhubung. Kandidat: filter nomor ortu salah field, filter hanya siswa BELUM kumpul tapi roster kosong, guard `waReady` matikan semua, atau `enqueueOutbox` gagal diam. JANGAN audit kirim manual dulu — alur guru = nudge. Catat kondisi persis yang bikin 0.
- [ ] **0.4 Audit push 500.** Cek `server/push.ts` (`endpointHash`), env VAPID (`VAPID_PUBLIC_KEY/PRIVATE`), dan apakah tabel `pushSubscription` ada di schema + migrasi jalan.
- [ ] **0.5 Audit assessments API.** Baca `app/api/assessments/route.ts` (field class? subject? status?) untuk kebutuhan page gabungan guru + count siswa.

### FASE 1 — Landing

- [ ] **1.1 Hapus section `#program` + `#mapel`.** File `apps/web/app/(portal)/page.tsx`: hapus blok `{/* 3 KARTU FITUR */}<section id="program"...>...</section>` dan `{/* MAPEL */}<section id="mapel"...>...</section>`, hapus link nav "Program/Mapel" (desktop line 67-68 + burger line 80) dan footer "Program/Mapel" (line ~383-384). Biarkan `subjects` fetch terhapus bila tak terpakai (hapus `SUBJECT_COLORS/SUBJECT_GLYPH` bila unused).
  - Verify: `npx tsc --noEmit` bersih; `curl -H "Host: demo.revy.my.id" http://127.0.0.1:3100/ | grep -ci "Kecil-kecil\|seribu kemungkinan"` → `0`.
- [ ] **1.2 Netralkan kata sejarah/Indonesia (KECUALI legal).** Ubah:
  - `app/buku/BukuClient.tsx:64,67,75,91,131`: "E-Book Sejarah & Indonesia" → "E-Book & Materi Pelajaran"; placeholder → "Cari buku, materi, tokoh, dsb…"; fallback subject `"Sejarah"` → `"Umum"`; deskripsi hapus "sejarah Indonesia".
  - `app/api/portal/popular-books/route.ts`: query archive `title:(sejarah+indonesia)` → query generik per semua mapel (mis. `mediatype:texts AND language:(ind OR eng)` + filter sekolah), subjects `["Sejarah","Nusantara",...]` → `["Matematika","IPA","Bahasa","IPS",...]`, fallback title `"Buku Sejarah Indonesia"` → `"Buku Pelajaran"`.
  - `app/api/portal/search-books/route.ts`: hapus filter `AND (indonesia OR sejarah)`, default subject `"Sejarah RI"` → `"Umum"`.
  - `app/(portal)/page.tsx:247` fallback `["Matematika","Bahasa Indonesia","IPA","IPS"]` → `["Matematika","Bahasa","IPA","IPS"]`.
  - `lib/parse-questions.ts` contoh `PLACEHOLDER_EXAMPLE` → contoh netral ("Ibu kota negara adalah…", "Air mendidih pada suhu 100°C (BENAR/SALAH)").
  - JANGAN ubah `app/privasi/page.tsx` (UU RI No.27/2022 legal) dan `server/ai-site-guide.ts` ("Bahasa Indonesia" = nama bahasa, bukan mapel).
  - Verify: `grep -rni "sejarah" apps/web/app apps/web/lib --include="*.tsx" --include="*.ts" | grep -v privasi` → kosong (di luar komentar).

### FASE 2 — Dashboard siswa

- [ ] **2.1 Hapus kartu metrik Menunggu + Lencana.** File `app/(dash)/siswa/dashboard.tsx`: hapus 2 blok `<Reveal delay={120}>` (Menunggu dikerjakan) dan `<Reveal delay={240}>` (Lencana). Grid metrik sisa 2 kartu (Tugas selesai + Bintang). Blok bawah biarkan.
  - Verify: `grep -c "Menunggu dikerjakan\|>Lencana<" app/\(dash\)/siswa/dashboard.tsx` → `0`; screenshot 390px + 1280px rapi.
- [ ] **2.2 Menu: keluarkan Tugas/Asesmen/Kartu, tambah Kelasku.** File `app/(dash)/layout.tsx` `MENUS.SISWA`: utama → Dasbor, Kelasku (`/siswa/kelasku`, icon `kelas`), Pengumuman, Pesan, Izin; lainnya → Papan peringkat, Profil. Hapus `/siswa/tugas`, `/siswa/asesmen`, `/siswa/kartu` dari menu DAN jadikan redirect 307 ke `/siswa/kelasku` (tugas, asesmen) dan `/siswa/profil` (kartu). Jangan biarkan direct-URL jalan sendiri.
  - Verify: login sebagai siswa, sidebar = 5 utama + 2 lainnya; curl `/siswa/tugas` → redirect kelasku.
- [ ] **2.3 API untuk Kelasku (perlu hasil 0.1/0.5).** Pilihan minimal: longgarkan `GET /api/timetable?classId=` agar role SISWA boleh baca **kelasnya sendiri saja** (resolve classId dari `studentProfile.classId`, tolak classId lain dengan 403). Jangan buka timetable global ke siswa.
  - TDD: test `timetable-siswa.test.ts` — siswa baca kelas sendiri 200, kelas lain 403, unauth 401.
  - Verify: `pnpm vitest run timetable-siswa` hijau; curl sebagai siswa ke kelas lain → `{"error":...}` 403.
- [ ] **2.4 Page `/siswa/kelasku`.** Buat `app/(dash)/siswa/kelasku/page.tsx`: fetch parallel `/api/tasks?status=semua` + `/api/assessments` (atau endpoint list asesmen siswa) + `/api/timetable?classId=<kelasku>`; grup per mapel (key `subjectId ?? subjectName`); tiap mapel = card berisi nama mapel, guru (dari jadwal), badge lingkaran kecil = jumlah BELUM/TERLAMBAT (tugas+asesmen), daftar jadwal (hari+jam), klik card → daftar tugas/asesmen mapel itu (expand di card atau route `/siswa/kelasku/[mapel]`). Mapel = union(jadwal.mapel, tugas.subject, asesmen.subject) agar tak ada yang hilang. Empty state: "Belum ada jadwal — hubungi admin."
  - Verify: siswa demo lihat N card sesuai jadwal X-IPA-1; badge angka = count manual via API; mobile card grid 1 kolom.

- [ ] **2.5 Kartu saya → gabung ke Profil.** Baca `app/(dash)/siswa/kartu/page.tsx` + `app/(dash)/siswa/profil/page.tsx`. Pindah blok QR + identitas ke atas halaman profil (component `KartuSection`, bukan copy-paste). Route `/siswa/kartu` jadi `redirect("/siswa/profil")`.
  - Verify: `/siswa/kartu` → 307 ke profil; QR tampil di profil.

### FASE 3 — Dashboard guru

- [ ] **3.1 Page gabungan + model SHARED (butuh 0.1 dulu).** URL FINAL: `/guru/tugas` (page tugas existing jadi page gabungan, tambah tab Jenis Tugas|Asesmen + filter Kelas dari `/api/assignments`, list gabungan sortir deadline-per-kelas); `/guru/asesmen` redirect ke `/guru/tugas`. Menu GURU: label `Tugas` tetap, hapus item `Asesmen`. Model: induk shared (judul/instruksi/subject/type) + join per-kelas (deadline, publishAt, allowLate, status). API list per kelas join deadline; nilai/pengumpulan per kelas terpisah (natural via siswa).
  - Verify: guru demo filter kelas X-IPA-1 → list benar; route lama 307.
- [ ] **3.2 Shared create/edit/delete.** API `POST /api/tasks` + `POST /api/assessments`: terima `classTargets: [{classId, deadline, publishAt, allowLate}]` (kompat `classId` tunggal). Buat 1 induk + N join satu transaksi. `PATCH`: field shared (title/instruction/subject/type) update induk (berlaku semua kelas); field per-kelas (deadline/publishAt/allowLate/status) update join baris itu saja. Form `tugas/new` + `asesmen/new`: checkbox multi-kelas + deadline per-kelas (default samakan). `DELETE /api/tasks/[id]?scope=kelas&classId=` → hapus join saja; `?scope=semua` → hapus induk + semua join + dialog konfirmasi 3 pilihan (kelas ini / semua / batal) di UI.
  - TDD: create 2 kelas → 1 induk + 2 join; PATCH judul → terlihat di kedua kelas; PATCH deadline kelas A tak ubah B; DELETE scope=kelas sisakan induk + join B.
  - Verify: buat shared ke 2 kelas → muncul di keduanya dengan deadline beda; `tsc` bersih.
- [ ] **3.3 Fix QR scan — Brave Android.** WAJIB fallback `jsqr` (lazy import di scanner saja) karena `BarcodeDetector` tak ada di Brave → loop saat ini `continue` diam = "nol interaksi". Tambah: (a) cek isi QR dashboard siswa — bila bukan token mentah `sms1-*`, samakan (dashboard render token mentah atau scanner terima format itu); (b) indikator status scan di UI ("mencari QR…" vs "decoder tidak tersedia" vs "QR tak dikenal: <prefix>") agar tak ada lagi mode diam; (c) tombol "Nyalakan kamera" tetap prasyarat (autoplay policy).
  - Verify: Brave Android HTTPS demo.revy.my.id → arahkan ke QR dashboard siswa → toast "Hadir — <nama>"; QR asing → pesan "QR tak dikenal" (bukan diam).
- [ ] **3.4 Fix WA nudge 0 antrean.** Audit `app/api/tasks/[id]/nudge/route.ts` (0.3) lalu perbaiki akar: kemungkinan filter roster/siswa-belum-kumpul kosong, nomor ortu salah field, atau guard waReady. Tambah di respons nudge: `candidateCount` + `alasan` per skip (tanpa nomor / sudah kumpul / enqueue gagal) agar "0" selalu bisa dijelaskan. Jangan ubah alur kirim manual admin.
  - Verify: nudge tugas dengan 1 siswa belum kumpul + nomor ortu valid → `waQueued: 1` + row di admin/wa; kasus 0 → respons sebut alasan.
- [ ] **3.5 Menu Jadwal guru (read-only).** Tambah `MENUS.GURU.utama`: `{ href:"/guru/jadwal", label:"Jadwal", icon:"jadwal" }`. Buat `app/(dash)/guru/jadwal/page.tsx`: pilih kelas (dari assignments) → tabel read-only reuse pola `admin/jadwal` (tanpa Tambah/Hapus). GET timetable sudah izinkan GURU.
  - Verify: guru lihat jadwal kelas ampuannya; kelas bukan ampuannya → kosong/403.

### FASE 4 — Dashboard admin

- [ ] **4.1 Hapus menu Mapel.** `MENUS.ADMIN.lainnya`: hapus `{ href:"/admin/mapel" }`. Page `admin/mapel/page.tsx` jangan dihapus dulu — jadikan redirect ke `/admin/jadwal` + banner "Mapel kini dari Jadwal". API `/api/subjects` tetap (dipakai form guru) sampai 4.3 selesai.
- [ ] **4.2 Jadwal: edit + import/export Excel.** File `app/(dash)/admin/jadwal/page.tsx` + `app/api/timetable/route.ts`:
  - Edit: tombol Edit per row → dialog (hari, jam mulai/selesai, mapel, guru) → `PATCH /api/timetable` (baru, validasi sama dengan POST). Tambah handler PATCH di route.
  - Export: `GET /api/timetable/export?classId=` → `.xlsx` FORMAT SENDIRI (keputusan user): kolom Hari|Mulai|Selesai|Mapel|Guru. Cek lib xlsx di repo dulu (`grep -r "xlsx" package.json apps/web/package.json`); pakai yang ada, jangan tambah dep bila sudah ada.
  - Import: `POST /api/timetable/import` (FormData xlsx, maks 10MB, pola `admin/import` + batch status) → validasi per baris, kembalikan `{ ok, gagal, errors[] }`; UI: tombol Unduh template (format sendiri, sama dengan export) + Upload.
  - TDD: test round-trip export→import 5 slot → 5 rows; jam invalid → 400 + error baris.
- [ ] **4.3 Mapel auto-mapping dari jadwal.** Spec: daftar mapel per kelas = `distinct(timetableSlot.subjectRef/subjectName where classId)`; penugasan guru = `distinct(teacherId where ...)`. Implementasi: tambah `GET /api/timetable/subjects?classId=` (atau sertakan `subjects` di GET timetable) + `GET /api/assignments/auto` (atau tombol "Sinkronkan dari jadwal" di `admin/penugasan/page.tsx` yang upsert assignments dari slot ada teacherId). Dropdown mapel di form guru ambil dari endpoint ini (filter per kelas), bukan `/api/subjects` global. `admin/mapel` tetap redirect.
  - Verify: tambah slot jadwal (Mapel Fisika, Guru X) → muncul di dropdown tugas guru + di daftar ajar guru X tanpa input manual.

### FASE 5 — Navigasi (DashShell + Bell)

- [ ] **5.1 Username mobile hide + nama kiri avatar desktop.** File `components/DashShell.tsx`: (a) tambah CSS `.dash-username{...} @media(max-width:767px){.dash-username{display:none}}`; (b) desktop: pindah `<span class="dash-username">` SEBELUM avatar (nama kiri, avatar kanan), chevron tetap paling kanan. Dropdown tetap tampilkan nama+role.
  - Verify: 390px username hilang; 1280px urutan nama→avatar→chevron.
- [ ] **5.2 Bell toggle kedip (klik ke-2 tutup-buka).** Dugaan: tombol lonceng `onClick` toggle + `if (!open) void reload()`; klik ke-2 saat panel terbuka = handler outside `pointerdown` (line 413) balapan dengan toggle click → tutup lalu buka lagi. Fix: jadikan sumber tutup tunggal — tombol hanya `setOpen(o=>!o)` tanpa reload-on-open (reload jalan via polling/socket), dan guard outside-handler abaikan event yang berasal dari tombol lonceng (ref tombol). Checklist manual + catat di plan.
  - Verify manual: klik lonceng → buka; klik lonceng lagi → TUTUP diam; klik item → Dialog detail (inbox boleh tutup dulu); tombol "Buka" ke href jalan.
- [ ] **5.3 Push error 500 (perlu hasil 0.4).** Repro: `POST /api/push/subscribe` sebagai user login → lihat log (VAPID? Prisma `P2002`/tabel hilang? `endpointHash`?). Perbaiki akar (bukan bungkam error): set env VAPID bila kosong + migrasi bila tabel hilang + pesan error spesifik ke UI (`Bell` sudah tampilkan `pushError`). Tambah tombol "Kirim notifikasi uji" (`POST /api/push/test`) di `admin/notifikasi` bila belum ada untuk verifikasi ujung-ujung.
  - Verify: toggle push → ON tanpa 500; notif uji muncul di browser; curl subscribe invalid → 400 (bukan 500).
- [ ] **5.4 Burger mobile jangan tampil di desktop.** Cek `app/globals.css` + Tailwind content mencakup `components/DashShell.tsx`; pastikan class `md:hidden` tak dioverride (`display:flex !important`?). Perbaikan CSS minimal + hapus override bila ada.
  - Verify: 1280px burger `display:none`; 390px burger tampil.
- [ ] **5.5 Inbox mobile full-width.** `.bell-panel` mobile → `position:fixed; left:12px; right:12px; top:60px; width:auto; max-height:70vh` (sesuai konvensi skill). Pastikan parent tak `overflow:hidden`.
  - Verify: 390px inbox penuh terbaca, tak terpotong; Esc + klik-luar menutup.

### FASE 6 — Login

- [ ] **6.1 Toggle mata show password.** File `app/login/page.tsx`: bungkus input password + tombol eye (`Eye`/`EyeOff` lucide, `aria-label="Tampilkan kata sandi"`/`"Sembunyikan"`, `aria-pressed`). State `showPw`, `type={showPw?"text":"password"}`. Tombol 44px, di dalam kanan input, tak merusak layout mobile.
  - Verify: klik mata → type text → klik lagi → password; `tsc` bersih.

## 4. Tests / validation (global, tiap task ikut TDD)

- Urutan TDD per task kode: tulis test gagal → run (lihat merah) → implementasi minimal → run (hijau) → commit.
- Perintah standar (dari `~/Projects/me/sms-lms`):
  - `pnpm --filter @sms/web exec tsc --noEmit` → harus bersih (heap OOM? ulang dengan `NODE_OPTIONS=--max-old-space-size=4096`).
  - Build: stop service, `rm -rf apps/web/.next`, `NODE_OPTIONS=--max-old-space-size=4096 pnpm --filter @sms/web build`, restart `sms-web.service`.
  - Smoke tenant: `curl -s -o /dev/null -w "%{http_code}" -H "Host: demo.revy.my.id" http://127.0.0.1:3100/login` → `200`; `/siswa` → `307`; `/tools` → `200`.
  - Login manual demo: ADMIN `admin@demo.sch.id`, GURU `guru@demo.sch.id`, SISWA `siswa@demo.sch.id` / `0012345678`, password `demo123` (hasil `scripts/dev/reset-db.sh`).
- Commit kecil per task jadi (bahasa Indonesia, mis. `siswa: hapus kartu metrik menunggu+lencana`).

## 5. Risks, tradeoffs, open questions

- Risiko: model SHARED butuh migrasi Prisma (induk + join per-kelas + backfill) — ini task paling berisiko; backfill wajib idempoten + rollback plan (jangan drop kolom lama sebelum 2 rilis hijau). Alternatif tanpa migrasi hanya bila terbukti terlalu berisiko.
- Risiko: hapus section landing merusak anchor `#program/#mapel` dari luar → terima (link internal semua diperbarui).
- Risiko: longgarkan `GET timetable` ke SISWA bocor data kelas lain → mitigasi: paksa classId = kelas sendiri, 403 sisanya + test.
- Risiko: fallback decoder `jsqr` tambah bundle → lazy-import di scanner saja.
- Risiko: WA Baileys butuh pairing ulang sesi putus → siapkan alur QR ulang di `admin/wa`, bukan auto-reconnect buta.
- Open tersisa (jawab saat eksekusi, bukan sekarang): nomor WA uji = 081227444729 (boleh kirim pesan uji sungguhan saat verifikasi 3.4).
