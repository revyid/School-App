#!/usr/bin/env bash
# Deploy apps/web + apps/worker → VPS.
#
#   bash scripts/deploy.sh            # default: local build (cepat, butuh RAM/disk lokal)
#   bash scripts/deploy.sh local      # build image di MESIN INI, kirim ke VPS
#   bash scripts/deploy.sh vps        # build image DI VPS (kirim source, build di server)
#   bash scripts/deploy.sh local web  # hanya web
#   bash scripts/deploy.sh vps worker # hanya worker
#
# Catatan:
#  - Mode local: butuh RAM ±4 GB & disk ±4 GB (podman storage). Push image via
#    `podman save | ssh podman load` (tanpa file temp di kedua sisi).
#  - Mode vps: butuh RAM/RAM di VPS (2 vCPU / 4 GB) — build Next.js di sana bisa
#    berat. Pilih mode ini kalau uplink lokal lambat.
#  - Setelah deploy: verifikasi otomatis (halaman publik + endpoint ter-gate).
set -euo pipefail

MODE="${1:-local}"
TARGET="${2:-all}"
VPS="ubuntu@139.190.103.107"
LOCAL="/home/revy/Projects/me/sms-lms"
REMOTE="/home/ubuntu/lacakedu"
WEB_IMG="localhost/lacakedu-web:latest"
WORKER_IMG="localhost/lacakedu-worker:latest"
MIN_FREE_GB=4

case "$MODE" in
  local|vps) ;;
  *) echo "mode tidak dikenal: $MODE (pakai: local | vps)"; exit 1 ;;
esac
case "$TARGET" in
  all|web|worker) ;;
  *) echo "target tidak dikenal: $TARGET (pakai: all | web | worker)"; exit 1 ;;
esac

need_free() {
  local free_gb
  free_gb=$(df -BG --output=avail "$1" | tail -1 | tr -dc '0-9')
  if [ "${free_gb:-0}" -lt "$MIN_FREE_GB" ]; then
    echo "ERROR: ruang disk kurang di $1 (butuh ~${MIN_FREE_GB} GB, tersedia ${free_gb} GB)."
    exit 1
  fi
}

build_local() {
  local name=$1 img=$2 dockerfile=$3
  echo "  build $name (lokal)..."
  podman build -t "$img" -f "$dockerfile" "$LOCAL" > "/tmp/deploy-$name.log" 2>&1 \
    || { echo "  BUILD GAGAL: /tmp/deploy-$name.log"; tail -20 "/tmp/deploy-$name.log"; exit 1; }
  tail -1 "/tmp/deploy-$name.log"
}

build_vps() {
  local name=$1 img=$2 dockerfile=$3
  echo "  build $name (di VPS)..."
  ssh "$VPS" "cd $REMOTE && podman build -t $img -f $dockerfile . > /tmp/build-$name.log 2>&1" \
    || { echo "  BUILD GAGAL di VPS:"; ssh "$VPS" "tail -20 /tmp/build-$name.log"; exit 1; }
  ssh "$VPS" "tail -1 /tmp/build-$name.log"
}

push_local() {
  local img=$1
  echo "  kirim $img → VPS (stream)..."
  podman save "$img" | ssh "$VPS" 'podman load' | tail -1
}

echo "== deploy mode=$MODE target=$TARGET =="

# 1) Source ke VPS. Mode vps MEMBUTUHKA source penuh (build di server),
#    jadi selalu sync seluruh repo (node_modules/.next tidak ikut).
echo "[1/5] sync source → VPS..."
# PENTING: tanpa --delete. File env/sertifikat/acme hanya ada di VPS;
# --delete pernah menghapusnya (semua env + certs hilang).
rsync -az --exclude node_modules --exclude .next --exclude .git --exclude data \
  --exclude dist --exclude '*.log' --exclude '**/.env' \
  --exclude '**/.env.*' --exclude '!**/.env.example' \
  --exclude 'certs/' --exclude 'acme/' --exclude 'acme-src/' \
  "$LOCAL/" "$VPS:$REMOTE/"

# 2) Build
# 1b) Config nginx (dipakai container nginx; letaknya ~/lacakedu/nginx/).
mkdir -p "$REMOTE/nginx" 2>/dev/null || true
ssh "$VPS" "mkdir -p $REMOTE/nginx"
rsync -az "$LOCAL/deploy/nginx/" "$VPS:$REMOTE/nginx/"

echo "[2/5] build image..."
if [ "$MODE" = "local" ]; then
  need_free /mnt/lacakedu 2>/dev/null || need_free /
  [ "$TARGET" != "worker" ] && build_local web "$WEB_IMG" "$LOCAL/deploy/images/Containerfile.web"
  [ "$TARGET" != "web" ] && build_local worker "$WORKER_IMG" "$LOCAL/deploy/images/Containerfile.worker"
else
  [ "$TARGET" != "worker" ] && build_vps web "$WEB_IMG" "deploy/images/Containerfile.web"
  [ "$TARGET" != "web" ] && build_vps worker "$WORKER_IMG" "deploy/images/Containerfile.worker"
fi

# 3) Kirim image (mode local). Mode vps: image sudah ada di server.
echo "[3/5] kirim image → VPS..."
if [ "$MODE" = "local" ]; then
  [ "$TARGET" != "worker" ] && push_local "$WEB_IMG"
  [ "$TARGET" != "web" ] && push_local "$WORKER_IMG"
else
  echo "  (image sudah dibangun di VPS)"
fi

# 4) Restart service
echo "[4/5] restart service..."
RESTART=""
[ "$TARGET" != "worker" ] && RESTART="lacakedu-web.service"
[ "$TARGET" != "web" ] && RESTART="$RESTART lacakedu-worker.service"
[ -n "$RESTART" ] && ssh "$VPS" "systemctl --user restart $RESTART"

# 5) Verifikasi
echo "[5/5] verifikasi..."
for i in $(seq 1 25); do
  code=$(ssh "$VPS" "curl -s -o /dev/null -w %{http_code} -m 5 -H 'Host: lacakedu.web.id' http://127.0.0.1:8080/beranda")
  [ "$code" = "200" ] && { echo "  /beranda => 200"; break; }
  echo "  waiting... ($i) => ${code:--}"
  sleep 2
done
ssh "$VPS" 'for p in /beranda /api/health /privasi; do printf "  %-14s => " "$p"; curl -s -o /dev/null -w "%{http_code}\n" -m 10 -H "Host: lacakedu.web.id" http://127.0.0.1:8080$p; done; printf "  %-14s => " "/api/root/users"; curl -s -o /dev/null -w "%{http_code} (401 = hidup & digate)\n" -m 10 -H "Host: lacakedu.web.id" "http://127.0.0.1:8080/api/root/users?perPage=5"'
echo "deploy selesai ✓"

# Bersihkan layer build yang menggantung (disk lokal pernah 97%).
[ "$MODE" = "local" ] && { podman image prune -f >/dev/null 2>&1 || true; df -h / | tail -1; }
