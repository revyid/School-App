# Setup Origin HTTPS di VPS (ganti tunnel → Cloudflare proxy ke IP)

Status: **origin HTTPS sudah aktif & teruji** (sertifikat placeholder).
Tunnel cloudflared **masih hidup** sebagai fallback sampai DNS dialihkan.

## Kenapa direct IP lebih cepat

| Jalur | TTFB | Throughput (conc 20) |
|---|---|---|
| Tunnel cloudflared (sekarang) | 0,2–1,4 s | 13,2 req/s |
| **HTTPS langsung ke VPS** | **0,08–0,16 s** | **46,8 req/s** |

Penyebab: tunnel menambah 2 hop (edge CF → cloudflared → nginx) dan koneksinya
terbagi ke 2 PoP (SIN + Kolkata) → sebagian request kena ~1 s.

## Yang sudah disiapkan di VPS

- `nginx` 3 listener:
  - `80` → hanya loopback host (`127.0.0.1:8080`) = origin untuk tunnel.
  - `8081` → publish host `0.0.0.0:80` = HTTP publik → **301 ke HTTPS**.
  - `443` → publish host `0.0.0.0:443` = HTTPS publik (sertifikat di `/etc/nginx/certs`).
- `acme.sh` terpasang di `~/lacakedu/acme` (DNS-01 Cloudflare).
- `~/lacakedu/bin/issue-cert.sh` — penerbitan sertifikat wildcard.
- `acme-renew.timer` (harian) renewed via `~/lacakedu/bin/renew-cert.sh`.
- Sertifikat placeholder (self-signed) sudah terpasang supaya 443 langsung hidup.

## Langkah kamu di dashboard Cloudflare

### 1. Token API (untuk penerbitan sertifikat wildcard)
`My Profile → API Tokens → Create Token`
- Template: **Edit zone DNS**
- Zone Resources: **Include → Specific zone → lacakedu.web.id**
- Simpan token, lalu di VPS:

```bash
cat > ~/lacakedu/acme.env <<'EOF'
DNS_API=dns_cf
CF_Token=TOKEN_ANDA
EOF
bash ~/lacakedu/bin/issue-cert.sh
curl -I https://lacakedu.web.id/beranda   # harus 200, sertifikat valid
```

### 2. Arahkan DNS ke VPS (ganti tunnel)
- DNS → Records: hapus/tambah record tunnel (`a8771381-82f3-41b2-9f5b-3312ef38ffb6.cfargotunnel.com` CNAME untuk apex & wildcard) → ganti dengan **A record ke 139.190.103.107** (proxy **ON**, ikon awan oranye).
- SSL/TLS → Overview: **Full (strict)** (sertifikat di origin wajib valid).
- SSL/TLS → Edge Certificates: **Minimum TLS Version = TLS 1.2** (tutup TLS 1.0/1.1 → grade A).
- SSL/TLS → Edge Certificates: **Always Use HTTPS = On** (biaya nol, wajib).
- Security → WAF: pastikan Managed Rules aktif.
- optionally: Speed → Caching → Cache Rules untuk `/beranda`, `/buku`, halaman legal (TTL 60–300 dtk) agar HTML tidak menembus origin tiap kunjungan.

> Cloudflare Free mengizinkan wildcard **DNS**, tapi proxy untuk wildcard needing
> DNS record per subdomain. Kalau wildcard tidak bisa di-proxy, tambahkan A record
> untuk tiap subdomain sekolah yang dipakai (`smansa.lacakedu.web.id`, dst).

### 3. Setelah DNS switch
```bash
# tunnel tidak perlu lagi, tapi boleh tetap hidup sebagai fallback:
systemctl --user disable --now cloudflared.service
# atau biarkan dulu 1-2 hari untuk aman
```

## Catatan
- `Server: nginx` (versi disembunyikan), `X-Powered-By` dihapus, HSTS
  `includeSubDomains`, header keamanan tunggal.
- TLS 1.0/1.1 masih bisa dibuka lewat edge CF **sampai** kamu set *Minimum TLS
  Version = 1.2* — itu setting dashboard, tidak bisa dari server.
- Kalau cert issuance gagal: `~/lacakedu/acme/acme.sh --issue --dns dns_cf -d lacakedu.web.id -d '*.lacakedu.web.id' --home ~/lacakedu/acme --log`
