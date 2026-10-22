# Backup & restore drill (Postgres + uploads)

Jadwal produksi: systemd timer harian (`deploy/quadlet/backup*.{service,timer}`).

## Variabel & retensi

- `BACKUP_DIR=/var/backups/lacakedu` (volume `backups`)
- Retensi dump: **90 hari** → `find /var/backups/lacakedu -name 'lacakedudb-*.dump' -mtime +90 -delete`
- Uploads disimpan sebagai **mirror terakhir (90 hari)**. Ruang kosong sensorik
  (media still, gambar paud, sketsa, dsb) bisa langsung dihapus dari volume tanpa
  mengganggu data aplikasi, atau perlu sinkronisasi eksternal ke luar server.

## Backup manual

```sh
# 1. Dump DB (dari host, via port loopback postgres container)
/usr/bin/pg_dump "postgresql://lacakedu:***@127.0.0.1:5432/lacakedudb" \
  -Fc -f /var/backups/lacakedu/lacakedudb-$(date +%F).dump

# 2. Uploads (rsync, delete agar mirror)
/usr/bin/rsync -a --delete /data/uploads/ /var/backups/lacakedu/uploads/

# 3. Catat hasil untuk dashboard super-admin (dibaca /api/admin/health)
echo "BACKUP_LAST_AT=$(date -u +%FT%TZ) BACKUP_LAST_RESULT=ok" >> /etc/lacakedu/backup.env
```

## Restore drill (mesin bersih)

```sh
# Siapkan volume kosong + jalankan pod (lihat docs/host-setup.md)
# 1. Restore DB ke database KOSONG (jangan timpa produksi!)
/usr/bin/pg_restore -C -d "postgresql://lacakedu:***@127.0.0.1:5432/postgres" \
  /var/backups/lacakedu/lacakedudb-YYYY-MM-DD.dump

# 2. Restore uploads
/usr/bin/rsync -a /var/backups/lacakedu/uploads/ /data/uploads/

# 3. Verifikasi
#   - login tiap peran di 1 sekolah sampel
#   - GET /api/admin/health (super-admin): schoolCount > 0, queues.failed = 0
#   - 1 scan QR + 1 submit tugas (idempoten, aman diulang)
```

## Retensi langganan push

- Endpoint push perangkat (browser/WhatsApp) **tidak otomatis dihapus** saat
  akun dihapus. API admin menyediakan cancel langganan yang bersih (Pasal 8 UU PDP),
  bukan mengandalkan ulang menjatuhkan aplikasi.
