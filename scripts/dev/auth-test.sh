#!/usr/bin/env bash
# Tes berjalan dengan sesi login: daftar halaman per peran + API kunci.
# Pakai: bash scripts/dev/auth.sh admin@demo.sch.id demo123
HOST="demo.localtest.me"
BASE="http://localhost:3100"
IDENT="${1:-admin@demo.sch.id}"
PASS="${2:-demo123}"

# 1. login, ambil cookie + csrf
RESP=$(curl -s -D /tmp/hdr.txt -X POST \
  -H "Host: $HOST" -H "content-type: application/json" \
  -H "Origin: http://$HOST" -H "Referer: http://$HOST/login" \
  -d "{\"identifier\":\"$IDENT\",\"password\":\"$PASS\"}" \
  "$BASE/api/auth/login")
SID=$(grep -i "^set-cookie:" /tmp/hdr.txt | sed 's/.*lacakedu-session-dev=\([^;]*\).*/\1/' | tr -d '\r')
CSRF=$(echo "$RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("csrfToken",""))' 2>/dev/null)
ROLE=$(echo "$RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("user",{}).get("role",""))' 2>/dev/null)
echo "login: role=$ROLE sid=${SID:0:8}… csrf=${CSRF:0:8}…"

if [ -z "$SID" ]; then echo "GAGAL login"; exit 1; fi
C="lacakedu-session-dev=$SID"
HC="Host: $HOST"
HX="x-csrf-token: $CSRF"
HO="Origin: http://$HOST"
HR="Referer: http://$HOST/"

echo ""
echo "=== HALAMAN (harap 200) ==="
case "$ROLE" in
  ADMIN) PAGES=("/admin" "/admin/kelas" "/admin/siswa" "/admin/guru" "/admin/jadwal" "/admin/notifikasi" "/admin/inbox" "/admin/kehadiran" "/admin/kalender" "/admin/penugasan" "/admin/pengumuman" "/admin/pengaturan" "/admin/privasi" "/admin/audit" "/admin/wa" "/admin/import");;
  GURU)  PAGES=("/guru" "/guru/kelas-saya" "/guru/tugas" "/guru/asesmen" "/guru/kehadiran" "/guru/inbox" "/guru/scanner" "/guru/izin" "/guru/rapor");;
  SISWA) PAGES=("/siswa" "/siswa/tugas" "/siswa/asesmen" "/siswa/izin" "/siswa/inbox" "/siswa/leaderboard" "/siswa/kartu" "/siswa/profil");;
esac
for p in "${PAGES[@]}"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -H "$HC" -H "Cookie: $C" "$BASE$p")
  printf "%s  %s\n" "$code" "$p"
done

echo ""
echo "=== API GET (harap 200) ==="
APIS=("/api/auth/me" "/api/portal/info" "/api/assessments" "/api/assignments" "/api/announcements" "/api/notifications")
for a in "${APIS[@]}"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -H "$HC" -H "Cookie: $C" "$BASE$a")
  printf "%s  %s\n" "$code" "$a"
done
