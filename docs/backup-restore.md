# Backup & restore drill (Postgres + uploads)

Jadwal produksi: systemd timer harian (lihat `deploy/quadlet/`).
Variabel: `BACKUP_DIR=/var/backups/sms` (volume `backups`), retensi 7 harian.

## Backup manual

```sh
# 1. Dump DB (dari host, via port loopback postgres container)
/usr/bin/pg_dump "postgresql://sms:***@127.0.0.1:5432/smsdb" \
  -Fc -f /var/backups/sms/smsdb-$(date +%F).dump

# 2. Uploads (rsync, delete agar mirror)
/usr/bin/rsync -a --delete /data/uploads/ /var/backups/sms/uploads/

# 3. Catat hasil untuk dashboard super-admin (dibaca /api/admin/health)
echo "BACKUP_LAST_AT=$(date -u +%FT%TZ) BACKUP_LAST_RESULT=ok" >> /etc/sms-lms/backup.env
```

## Restore drill (mesin bersih)

```sh
# 1. Siapkan volume kosong + jalankan pod (lihat docs/host-setup.md)
# 2. Restore DB ke database KOSONG (jangan timpa produksi!)
/usr/bin/pg_restore -C -d "postgresql://sms:***@127.0.0.1:5432/postgres" \
  /var/backups/sms/smsdb-YYYY-MM-DD.dump

# 3. Restore uploads
/usr/bin/rsync -a /var/backups/sms/uploads/ /data/uploads/

# 4. Verifikasi
#   - login tiap peran di 1 sekolah sampel
#   - GET /api/admin/health (super-admin): schoolCount > 0, queues.failed = 0
#   - 1 scan QR + 1 submit tugas (idempoten, aman diulang)
```

## Retensi

Hapus dump > 7 hari: `find /var/backups/sms -name 'smsdb-*.dump' -mtime +7 -delete`.
Uploads mirror tidak di-prune (mirror = kondisi terakhir).
