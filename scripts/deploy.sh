#!/usr/bin/env bash
# Deploy apps/web → VPS (1 command).
# Build di VPS: disk local penuh (97%), VPS masih lega.
# Env files di ~/lacakedu TIDAK disentuh (tidak ada di repo).
set -euo pipefail

VPS="ubuntu@139.190.103.107"
LOCAL="/home/revy/Projects/me/sms-lms"
REMOTE="/home/ubuntu/lacakedu"
IMG="localhost/lacakedu-web:latest"

echo "[1/3] sync source → VPS..."
rsync -az --exclude node_modules --exclude .next --exclude .git \
  --exclude data --exclude dist --exclude '*.log' \
  "$LOCAL/" "$VPS:$REMOTE/"

echo "[2/3] build image di VPS..."
ssh "$VPS" "cd $REMOTE && podman build -t $IMG -f deploy/images/Containerfile.web . > /tmp/web-build.log 2>&1 && tail -2 /tmp/web-build.log"

echo "[3/3] restart + verifikasi..."
ssh "$VPS" "systemctl --user restart lacakedu-web.service"
for i in $(seq 1 25); do
  code=$(ssh "$VPS" "curl -s -o /dev/null -w %{http_code} -H 'Host: lacakedu.web.id' --max-time 3 http://127.0.0.1:8080/beranda")
  [ "$code" = "200" ] && { echo "  /beranda => 200"; break; }
  echo "  waiting... ($i) => ${code:--}"
  sleep 2
done

ssh "$VPS" 'SID=$(curl -s -D - -o /dev/null -X POST http://127.0.0.1:8080/api/auth/admin-login -H "Host: lacakedu.web.id" -H "Origin: https://lacakedu.web.id" -H "Content-Type: application/json" -d "{\"email\":\"admin@lacakedu.web.id\",\"password\":\"qeB-srzOcSPl-Hit\"}" | grep -o "__Host-session=[^;]*" | cut -d= -f2); echo "  /api/auth/me => $(curl -s -b "Cookie: __Host-session=$SID" -H "Host: lacakedu.web.id" http://127.0.0.1:8080/api/auth/me | head -c 90)"; echo "  /api/root/users => $(curl -s -o /dev/null -w %{http_code} -b "Cookie: __Host-session=$SID" -H "Host: lacakedu.web.id" "http://127.0.0.1:8080/api/root/users?perPage=200")"'
echo "deploy selesai ✓"
