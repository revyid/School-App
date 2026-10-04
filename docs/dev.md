# Dev lokal

Gunakan `APEX_DOMAIN=localtest.me` (`*.localtest.me` me-resolve ke 127.0.0.1
tanpa perlu edit /etc/hosts — butuh internet untuk DNS publik ini).

Contoh: sekolah `sman1` → `http://sman1.localtest.me:3000/login`
(cookie `__Host-session` butuh Secure → di dev pakai `https` via nginx
atau set `NODE_TLS_REJECT_UNAUTHORIZED` sesuai kebutuhan; login API tetap
menolak tanpa Origin yang cocok).

Jalankan postgres + redis sementara untuk dev/test (port loopback saja):

podman run -d --name sms-test-pg -e POSTGRES_USER=sms -e POSTGRES_PASSWORD=*** -e POSTGRES_DB=smsdb -p 127.0.0.1:5432:5432 docker.io/library/postgres:18
podman run -d --name sms-test-redis -p 127.0.0.1:6379:6379 docker.io/library/redis:8 redis-server --appendonly yes
podman exec -i sms-test-pg psql -U sms -d smsdb < scripts/db-create-roles.sql
