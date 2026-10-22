#!/usr/bin/env bash
# Deploy apps/web + apps/worker → VPS (1 command).
#
# ALUR: build image DI LOCAL → kirim ke VPS (stream) → restart → verifikasi.
# Build di VPS DIHINDARI: mesin 2 vCPU/4 GB kewalahan saat `next build`
# (VPS sempat reboot & unresponsive). Local build butuh ~3 GB disk + RAM正常.
#
# Syarat: podman lokal aktif, disk lokal cukup (butuh ~3 GB).
set -euo pipefail

VPS="ubuntu@139.190.103.107"
LOCAL="/home/revy/Projects/me/sms-lms"
REMOTE="/home/ubuntu/lacakedu"
WEB_IMG="localhost/lacakedu-web:latest"
WORKER_IMG="localhost/lacakedu-worker:latest"
MIN_FREE_GB=4

need_free() {
  local free_gb
  free_gb=$(df -BG --output=avail / | tail -1 | tr -dc '0-9')
  if [ "${free_gb:-0}" -lt "$MIN_FREE_GB" ]; then
    echo "ERROR: disk lokal kurang (butuh ~${MIN_FREE_GB} GB, tersedia ${free_gb} GB)."
    echo "Bersihkan dulu: podman image prune -af && podman volume prune -f"
    exit 1
  fi
}

echo "[1/5] build image web di LOCAL..."
need_free
podman build -t "$WEB_IMG" -f "$LOCAL/deploy/images/Containerfile.web" "$LOCAL" > /tmp/deploy-web.log 2>&1
tail -1 /tmp/deploy-web.log

echo "[2/5] build image worker di LOCAL..."
podman build -t "$WORKER_IMG" -f "$LOCAL/deploy/images/Containerfile.worker" "$LOCAL" > /tmp/deploy-worker.log 2>&1
tail -1 /tmp/deploy-worker.log

echo "[3/5] kirim image ke VPS (stream, tanpa file temp)..."
podman save "$WEB_IMG" | ssh -o BatchMode=yes -o StrictHostKeyChecking=no "$VPS" 'podman load'
podman save "$WORKER_IMG" | ssh -o BatchMode=yes -o StrictHostKeyChecking=no "$VPS" 'podman load'

echo "[4/5] mirror file operasional (quadlet/nginx) & restart..."
rsync -az --exclude node_modules --exclude .next --exclude .git --exclude data --exclude dist \
  --exclude '*.log' --exclude '**/.env' "$LOCAL/deploy/" "$VPS:$REMOTE/deploy/"
ssh -o BatchMode=yes -o StrictHostKeyChecking=no "$VPS" "systemctl --user restart lacakedu-web.service lacakedu-worker.service"

echo "[5/5] verifikasi..."
for i in $(seq 1 25); do
  code=$(ssh -o BatchMode=yes -o StrictHostKeyChecking=no "$VPS" "curl -s -o /dev/null -w %{http_code} -m 5 -H 'Host: lacakedu.web.id' http://127.0.0.1:8080/beranda")
  [ "$code" = "200" ] && { echo "  /beranda => 200"; break; }
  echo "  waiting... ($i) => ${code:--}"
  sleep 2
done

# Verifikasi tanpa kredensial: cek halaman publik + API root hidup & ter-gate.
ssh -o BatchMode=yes -o StrictHostKeyChecking=no "$VPS" 'for p in /beranda /api/health /privasi; do printf "  %-16s => " "$p"; curl -s -o /dev/null -w "%{http_code}\n" -m 10 -H "Host: lacakedu.web.id" http://127.0.0.1:8080$p; done; printf "  %-16s => " "/api/root/users"; curl -s -o /dev/null -w "%{http_code} (401 = hidup & digate)\n" -m 10 -H "Host: lacakedu.web.id" "http://127.0.0.1:8080/api/root/users?perPage=5"; printf "  %-16s => " "/api/books"; curl -s -o /dev/null -w "%{http_code} (401 = hidup & digate)\n" -m 10 -H "Host: lacakedu.web.id" http://127.0.0.1:8080/api/books'
echo "deploy selesai ✓"
