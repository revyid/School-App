# Uji manual WhatsApp (Baileys sungguhan)

Tes otomatis memakai `FakeProvider` (`WA_FAKE=1`) — Baileys asli TIDAK diuji
otomatis karena butuh nomor WA + pairing QR fisik. Langkah uji manual:

1. Siapkan env worker:
   - `WA_SESSIONS_ROOT=/data/wa-sessions` (volume podman, per sekolah `<schoolId>/`)
   - `INTERNAL_TOKEN=<acak-panjang>` (sama di web `INTERNAL_TOKEN` + worker)
   - `WORKER_PORT=3001` di web bila port worker non-default.
   - JANGAN set `WA_FAKE=1` (itu mode fake untuk tes).
2. Jalankan worker, buka sebagai ADMIN: `/admin/wa`.
3. Status awal "Putus/menghubungkan" + QR pairing muncul (refresh bila kosong —
   QR dibuat saat `ensureSession`, kedaluwarsa ~60 dtk, muat ulang untuk baru).
4. Di HP nomor WA sekolah: Tautkan perangkat → pindai QR.
5. Status berubah "Terhubung". Auth state tersimpan di
   `wa-sessions/<schoolId>/` — restart worker tidak perlu pairing ulang.
6. Uji kirim: `POST /api/wa/outbox` (ADMIN, `{to:"08…", text:"tes"}`) →
   cek antrean SENT di halaman yang sama + pesan tiba di HP tujuan.
7. Uji pemicu: tandai siswa ALPHA hari ini → cron auto-alpha / tick berikutnya
   membuat outbox `alpha-<studentId>-<date>` (cek di DB/outbox). Bila nomor
   ortu (`parentPhone`) terisi, pesan terkirim dengan jeda 3–10 dtk.
8. Uji kuota: set `waDailyCap` kecil di `/admin/pengaturan` → kiriman di atas
   cap gagal dengan `lastError` "kuota harian tercapai" dan di-retry backoff.
9. Putus sesi: Keluar dari "Perangkat tertaut" di HP → status jadi Putus +
   admin menerima notifikasi in-app "Sesi WA putus" (maks 1x/24 jam).

Catatan: tanpa fallback kanal — bila WA putus, pesan TETAP di antrean
(QUEUED/SENDING) dan dikirim setelah sesi pulih. Tidak ada SMS/email cadangan.
