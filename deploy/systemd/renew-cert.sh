#!/bin/sh
# Dipanggil acme-renew.timer tiap hari. --renew memakai config tersimpan saat
# issuance (tanpa --dns). Exit 2 = belum jatuh tempo -> BUKAN error.
set -u
: "${ACME_HOME:=$HOME/lacakedu/acme}"
DOMAIN="lacakedu.web.id"
ENV_FILE="$HOME/lacakedu/acme.env"

[ -f "$ENV_FILE" ] || { echo "acme.env belum ada, lewati renewal"; exit 0; }
# set -a: acme.sh (child process) butuh variabel ini di environment.
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a
: "${DNS_API:?DNS_API belum di-set (lihat acme.env)}"
CF_Token="$(printf '%s' "${CF_Token:-}" | tr -d '[:space:]')"
[ -n "$CF_Token" ] && export CF_Token

# Belum ada sertifikat untuk domain ini (issuance manual belum dijalankan) -> lewati.
if ! "$ACME_HOME/acme.sh" --list --home "$ACME_HOME" 2>/dev/null | grep -q "$DOMAIN"; then
  echo "belum ada sertifikat untuk $DOMAIN, lewati renewal"
  exit 0
fi

"$ACME_HOME/acme.sh" --renew -d "$DOMAIN" --home "$ACME_HOME"
code=$?
if [ "$code" -eq 2 ]; then echo "cert masih berlaku"; exit 0; fi
if [ "$code" -ne 0 ]; then echo "renew gagal: $code"; exit "$code"; fi

"$ACME_HOME/acme.sh" --install-cert -d "$DOMAIN" \
  --fullchain-file "$HOME/lacakedu/certs/fullchain.pem" \
  --key-file "$HOME/lacakedu/certs/privkey.pem" \
  --home "$ACME_HOME"
podman exec lacakedu-nginx nginx -s reload 2>/dev/null || \
  systemctl --user restart lacakedu-nginx
