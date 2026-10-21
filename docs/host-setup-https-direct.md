# Setup Origin HTTPS di VPS (ganti tunnel → Cloudflare proxy ke IP)

Status: **sertifikat sudah terbit** (Let's Encrypt ECC, `CN=lacakedu.web.id` +
wildcard, berlaku s.d. 19 Jan 2027, renewal otomatis 20 Des 2026).
Tunnel cloudflared **masih hidup** sebagai fallback sampai DNS dialihkan.

## Kenapa direct IP lebih cepat

| Jalur | TTFB | Throughput (conc 20) |
|---|---|---|
| Tunnel cloudflared (sekarang) | 0,2–1,4 s | 13,2 req/s |
| **HTTPS langsung ke VPS** | **0,08–0,16 s** | **44,5 req/s** |

Penyebab: tunnel menambah 2 hop (edge CF → cloudflared → nginx) dan koneksinya
terbagi ke 2 PoP (SIN + Kolkata) → sebagian request kena ~1 s.

## Yang sudah disiapkan di VPS

- `nginx` 3 listener:
  - `80` → hanya loopback host (`127.0.0.1:8080`) = origin untuk tunnel.
  - `8081` → publish host `0.0.0.0:80` = HTTP publik → **301 ke HTTPS**.
  - `443` → publish host `0.0.0.0:443` = HTTPS publik.
- `acme.sh` terpasang di `~/lacakedu/acme` (DNS-01 Cloudflare), sertifikat di
  `~/lacakedu/certs/{fullchain,privkey}.pem`.
- `~/lacakedu/bin/issue-cert.sh` — penerbitan/renewal sertifikat wildcard.
- `acme-renew.timer` (harian) → `~/lacakedu/bin/renew-cert.sh` (renew otomatis).

## Langkah kamu di dashboard Cloudflare

### 1. DNS → arahkan ke VPS (ganti tunnel)
- DNS → Records: hapus record tunnel (`…cfargotunnel.com` CNAME untuk apex &
  wildcard) → ganti dengan **A record ke 139.190.103.107** (proxy **ON**).
- SSL/TLS → Overview: **Full (strict)** (sertifikat origin sudah valid).
- SSL/TLS → Edge Certificates: **Minimum TLS Version = TLS 1.2** (tutup TLS 1.0/1.1 → grade A).
- SSL/TLS → Edge Certificates: **Always Use HTTPS = On**.
- Security → WAF: Managed Rules aktif.
- Speed → Caching → Cache Rules untuk `/beranda`, `/buku`, halaman legal (TTL 60–300 dtk).

> Kalau wildcard tidak bisa di-proxy di plan CF Free, tambahkan A record untuk
> tiap subdomain sekolah yang dipakai (`smansa.lacakedu.web.id`, dst).

### 2. Setelah DNS switch
```bash
systemctl --user disable --now cloudflared.service   # tunnel tidak perlu lagi
# atau biarkan 1-2 hari sebagai fallback
```

### 3. Rotasi token (penting)
Token CF API sempat tertulis di chat/terminal — setelah semua selesai, revoke
token itu di dashboard dan buat baru, lalu update `~/lacakedu/acme.env`.

## Catatan
- `Server: nginx` (versi disembunyikan), `X-Powered-By` dihapus, HSTS
  `includeSubDomains`, header keamanan tunggal.
- Renewal otomatis: `bash ~/lacakedu/bin/renew-cert.sh` (aman dipanggil manual).
- Kalau cert issuance gagal: `~/lacakedu/acme/acme.sh --issue --dns dns_cf -d lacakedu.web.id -d '*.lacakedu.web.id' --home ~/lacakedu/acme --log`

