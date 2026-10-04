# Catatan auth

- Sesi = sid opak 256-bit di cookie `__Host-session`; Redis sumber kebenaran.
- `sesi.schoolId == schoolId subdomain` dicek tiap request (web + socket).
- Tanpa pasta (fallback gateway IP): set `TRUST_GATEWAY_IP=1` di web.env —
  batas per-IP dilonggarkan 10x, batas per-AKUN tetap 5x/5mnt. Jangan
  andalkan rate limit per-IP sebagai satu-satunya pertahanan dalam mode ini.
- Login yang diblokir rate limit SENGAJA tidak ditulis ke AuditLog
  (mencegah banjir baris saat brute-force).
- Verifikasi nonce browser: buka halaman → DevTools → Network → dokumen →
  header CSP memuat `'nonce-<base64>'` yang SAMA dengan atribut `nonce=` pada
  `<script>` di View Source; console bersih dari pelanggaran CSP.
