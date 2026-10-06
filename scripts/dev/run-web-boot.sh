#!/bin/bash
# Stable boot entrypoint for SMS-LMS web (:3100). Do NOT use scratch/run-next.sh (pruned).
export APEX_DOMAIN="localtest.me"
export UPLOADS_ROOT="/tmp/sms-uploads"
export NODE_OPTIONS="--max-old-space-size=4096"
export SMS_COOKIE_SECURE="0"
export SMS_COOKIE_NAME="sms-session-dev"
export PATH="/home/revy/.hermes/tools/node-26.7.0-linux-x64/bin:/usr/bin:/bin"
BASE="/home/revy/Projects/me/sms-lms"
if [ -f "$BASE/apps/worker/.env" ]; then set -a; source "$BASE/apps/worker/.env"; set +a; fi
if [ -f "$BASE/apps/web/.env" ]; then set -a; source "$BASE/apps/web/.env"; set +a; fi
cd "$BASE/apps/web"
exec pnpm exec next start -p 3100
