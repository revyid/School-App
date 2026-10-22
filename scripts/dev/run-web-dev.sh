#!/bin/bash
# Dev-mode web SMS-LMS (:3101) — dijalankan manual, TANPA autostart.
export APEX_DOMAIN="localtest.me"
export AI_CHAT_ENABLED="true"
export UPLOADS_ROOT="/home/revy/Projects/me/sms-lms/data/uploads"
export LACAKEDU_COOKIE_SECURE="0"
export LACAKEDU_COOKIE_NAME="lacakedu-session-dev3101"
export PATH="/home/revy/.hermes/tools/node-26.7.0-linux-x64/bin:/usr/bin:/bin"
BASE="/home/revy/Projects/me/sms-lms"
if [ -f "$BASE/apps/worker/.env" ]; then set -a; source "$BASE/apps/worker/.env"; set +a; fi
if [ -f "$BASE/apps/web/.env" ]; then set -a; source "$BASE/apps/web/.env"; set +a; fi
cd "$BASE/apps/web"
exec pnpm exec next dev -p 3101
