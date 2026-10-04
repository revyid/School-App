#!/bin/sh
# Dipanggil acme-renew.timer tiap hari. --renew memakai config tersimpan saat
# issuance (tanpa --dns). Exit 2 = belum jatuh tempo -> BUKAN error.
set -u
: "${ACME_HOME:=$HOME/sms-lms/acme}"
: "${DNS_API:?DNS_API belum di-set (lihat acme.env)}"

"$ACME_HOME/acme.sh" --renew -d 'domainmu.id'
code=$?
if [ "$code" -eq 2 ]; then echo "cert masih berlaku"; exit 0; fi
if [ "$code" -ne 0 ]; then echo "renew gagal: $code"; exit "$code"; fi
"$ACME_HOME/acme.sh" --install-cert -d 'domainmu.id' \
  --fullchain-file "$HOME/sms-lms/certs/fullchain.pem" \
  --key-file "$HOME/sms-lms/certs/privkey.pem"
podman exec sms-lms-nginx nginx -s reload
