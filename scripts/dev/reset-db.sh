#!/usr/bin/env bash
# Reset DB dev dengan aman (anti-corrupt) — sumber kredensial tunggal: apps/web/.env.local
# Pakai:  scripts/dev/reset-db.sh [--seed-only] [--no-backup]
# - Volume bernama sms-pgdata/sms-redisdata: recreate container TIDAK menghapus data.
# - Backup otomatis via pg_dump sebelum reset (kecuali --no-backup).
# - DATABASE_URL disamakan ke apps/web/.env dan apps/worker/.env agar server tidak 500 (P1000/P1001).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_LOCAL="$ROOT/apps/web/.env.local"
BACKUP_DIR="$ROOT/backups"
SEED_ONLY=0
BACKUP=1
for a in "$@"; do
  case "$a" in
    --seed-only) SEED_ONLY=1 ;;
    --no-backup) BACKUP=0 ;;
  esac
done

DB_URL="$(grep -E '^DATABASE_URL=' "$ENV_LOCAL" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
if [ -z "$DB_URL" ]; then echo "DATABASE_URL kosong di $ENV_LOCAL" >&2; exit 1; fi
# Parse postgresql://user:pass@host:port/db
DB_USER="$(echo "$DB_URL" | sed -E 's|.*://([^:]+):.*|\1|')"
DB_PASS="$(echo "$DB_URL" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')"
DB_HOSTPORT="$(echo "$DB_URL" | sed -E 's|.*@([^/]+)/.*|\1|')"
DB_HOST="${DB_HOSTPORT%:*}"
DB_PORT="${DB_HOSTPORT##*:}"
DB_NAME="$(echo "$DB_URL" | sed -E 's|.*/([^?]+).*|\1|')"
export PGPASSWORD="$DB_PASS"
PSQL=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME")

if [ "$BACKUP" = 1 ] && [ "$SEED_ONLY" = 0 ]; then
  mkdir -p "$BACKUP_DIR"
  STAMP="$(date +%Y%m%d-%H%M%S)"
  if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$BACKUP_DIR/dev-$STAMP.sql" 2>/dev/null; then
    echo "backup: $BACKUP_DIR/dev-$STAMP.sql"
  else
    echo "backup: dilewati (DB lama tidak terjangkau)"
  fi
fi

# Samakan DATABASE_URL ke web/.env dan worker/.env (sumber: .env.local)
for f in "$ROOT/apps/web/.env" "$ROOT/apps/worker/.env"; do
  if [ -f "$f" ] && grep -q '^DATABASE_URL=' "$f"; then
    python3 - "$f" "$DB_URL" <<'EOF'
import re, sys
f, url = sys.argv[1], sys.argv[2]
lines = open(f).read().splitlines()
open(f, 'w').write('\n'.join([('DATABASE_URL=' + url) if l.startswith('DATABASE_URL=') else l for l in lines]) + '\n')
EOF
    echo "sync: $f"
  fi
done

if [ "$SEED_ONLY" = 0 ]; then
  podman volume create sms-pgdata >/dev/null 2>&1 || true
  podman volume create sms-redisdata >/dev/null 2>&1 || true
  podman rm -f sms-test-pg sms-test-redis >/dev/null 2>&1 || true
  podman run -d --name sms-test-pg \
    -e "POSTGRES_DB=$DB_NAME" -e "POSTGRES_USER=$DB_USER" -e "POSTGRES_PASSWORD=$DB_PASS" \
    -p "127.0.0.1:${DB_PORT}:5432" -v sms-pgdata:/var/lib/postgresql/data \
    postgres:18 >/dev/null
  podman run -d --name sms-test-redis \
    -p 127.0.0.1:6380:6379 -v sms-redisdata:/data \
    redis:8 redis-server --appendonly yes >/dev/null
  echo "container: recreated (volume sms-pgdata/sms-redisdata dipertahankan)"
  for i in $(seq 1 30); do
    if "${PSQL[@]}" -tAc 'SELECT 1' >/dev/null 2>&1; then break; fi
    sleep 1
    [ "$i" = 30 ] && { echo "postgres tidak ready" >&2; exit 1; }
  done
  echo "postgres: ready"
  (cd "$ROOT/packages/db" && MIGRATE_URL="$DB_URL" pnpm exec prisma db push)
fi

# Seed akun demo — hash Argon2id dibuat saat runtime (tanpa secret di repo)
HASH="$(cd "$ROOT/apps/web" && node -e "import('argon2').then(a => a.hash('demo123', { type: a.argon2id }).then(h => console.log(h)))")"
"${PSQL[@]}" -v hash="$HASH" <<'EOF'
INSERT INTO "School" (id, slug, name, "updatedAt") VALUES ('sch-demo-id', 'demo', 'SMA Negeri Demo', NOW()) ON CONFLICT (slug) DO NOTHING;
INSERT INTO "Class" (id, "schoolId", name, "gradeLevel") VALUES ('cls-demo-id', 'sch-demo-id', 'X-IPA-1', '10') ON CONFLICT DO NOTHING;
INSERT INTO "User" (id, "schoolId", role, email, "passwordHash", name, "isActive", "createdAt", "updatedAt")
VALUES
  ('usr-admin-demo', 'sch-demo-id', 'ADMIN', 'admin@demo.sch.id', :'hash', 'Administrator Demo', true, NOW(), NOW()),
  ('usr-guru-demo', 'sch-demo-id', 'GURU', 'guru@demo.sch.id', :'hash', 'Guru Demo, S.Pd', true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash";
INSERT INTO "User" (id, "schoolId", role, email, nisn, "passwordHash", name, "isActive", "createdAt", "updatedAt")
VALUES
  ('usr-siswa-demo', 'sch-demo-id', 'SISWA', 'siswa@demo.sch.id', '0012345678', :'hash', 'Siswa Budi Utomo', true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash";
INSERT INTO "StudentProfile" (id, "schoolId", "userId", "classId") VALUES ('sp-siswa-demo', 'sch-demo-id', 'usr-siswa-demo', 'cls-demo-id') ON CONFLICT DO NOTHING;
EOF
"${PSQL[@]}" -c 'SELECT email, role FROM "User" ORDER BY email;'
echo "SEED OK"
