#!/usr/bin/env bash
# Smoke test: semua rute publik + terproteksi, pakai Host demo.localtest.me
HOST="demo.localtest.me"
BASE="http://localhost:3100"

PUBLIC=(
  "/" "/perkakas" "/perkakas/peta" "/perkakas/buku" "/buku" "/anonim"
  "/login" "/syarat" "/privasi" "/tools" "/tools/peta"
)
PROTECTED=(
  "/siswa" "/siswa/tugas" "/siswa/asesmen" "/siswa/izin" "/siswa/inbox"
  "/siswa/leaderboard" "/siswa/kartu" "/siswa/profil"
  "/guru" "/guru/kelas-saya" "/guru/tugas" "/guru/asesmen" "/guru/kehadiran"
  "/guru/inbox" "/guru/scanner" "/guru/izin" "/guru/rapor"
  "/admin" "/admin/kelas" "/admin/siswa" "/admin/guru" "/admin/jadwal"
  "/admin/notifikasi" "/admin/inbox" "/admin/kehadiran" "/admin/kalender"
  "/admin/penugasan" "/admin/pengumuman" "/admin/pengaturan" "/admin/privasi"
  "/admin/audit" "/admin/wa" "/admin/import" "/change-password"
)

echo "=== PUBLIK (harap 200) ==="
for p in "${PUBLIC[@]}"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: $HOST" "$BASE$p")
  echo "$code  $p"
done

echo ""
echo "=== TERPROTEKSI tanpa login (harap 307/302 redirect ke /login) ==="
for p in "${PROTECTED[@]}"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: $HOST" "$BASE$p")
  echo "$code  $p"
done
