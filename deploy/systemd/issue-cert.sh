#!/bin/sh
# Terbitkan sertifikat wildcard (apex + *.lacakedu.web.id) via acme.sh DNS-01 Cloudflare.
# Sekali jalan, berikutnya cukup acme-renew.timer (renew-cert.sh).
#
# CARA PAKAI:
#   1. Di dashboard Cloudflare: My Profile > API Tokens > Create Token
#      - Template "Edit zone DNS"  (izin: Zone / DNS / Edit)
#      - Zone Resources: Include > specific zone > lacakedu.web.id
#   2. Simpan token ke ~/lacakedu/acme.env:
#        DNS_API=dns_cf
#        CF_Token=<token>
#   3. Jalankan:  bash ~/lacakedu/bin/issue-cert.sh
set -eu

: "${ACME_HOME:=$HOME/lacakedu/acme}"
DOMAIN="lacakedu.web.id"
ENV_FILE="$HOME/lacakedu/acme.env"

[ -f "$ENV_FILE" ] || { echo "belum ada $ENV_FILE (DNS_API + CF_Token)"; exit 1; }
# shellcheck disable=SC1090
. "$ENV_FILE"
: "${DNS_API:?DNS_API belum di-set di $ENV_FILE}"
: "${CF_Token:?CF_Token belum di-set di $ENV_FILE}"

mkdir -p "$HOME/lacakedu/certs"

"$ACME_HOME/acme.sh" --issue --server letsencrypt --dns "$DNS_API" \
  -d "$DOMAIN" -d "*.$DOMAIN" --home "$ACME_HOME"

"$ACME_HOME/acme.sh" --install-cert -d "$DOMAIN" \
  --fullchain-file "$HOME/lacakedu/certs/fullchain.pem" \
  --key-file "$HOME/lacakedu/certs/privkey.pem" \
  --home "$ACME_HOME"

podman exec lacakedu-nginx nginx -s reload 2>/dev/null || \
  systemctl --user restart lacakedu-nginx

echo "sertifikat terpasang: $HOME/lacakedu/certs/fullchain.pem"
echo "cek: curl -I https://$DOMAIN/beranda"
