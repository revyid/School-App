# Setup host (sekali saja)

loginctl enable-linger $USER

# Port rendah rootless — wajib supaya 80/443 bisa dipublish (rootless podman
# tidak boleh bind <1024 tanpa ini).
sudo sysctl -w net.ipv4.ip_unprivileged_port_start=80
# persisten: /etc/sysctl.d/99-rootless-ports.conf

cp deploy/quadlet/* ~/.config/containers/systemd/
cp deploy/systemd/* ~/.config/systemd/user/
systemctl --user daemon-reload
# Unit memakai Quadlet .network (bukan .pod): key `Pod=` baru ada di Podman 5,
# sedangkan Ubuntu 22.04 maksimal Podman 4.6. Butuh Podman >= 4.4.
# Start SEMUA unit container (bukan hanya pod):
systemctl --user start lacakedu-postgres.service lacakedu-redis.service
systemctl --user start lacakedu-web.service lacakedu-worker.service lacakedu-nginx.service
# Satu-satunya yang di-enable: timer sertifikat:
systemctl --user enable acme-renew.timer

# Operasi rutin: start/stop/restart saja, never enable unit Quadlet
# (autostart berasal dari blok [Install]).

## Listener nginx (3 port)
- `80` internal (hanya `127.0.0.1:8080` di host) = origin untuk tunnel cloudflared.
- `80` publik (host `0.0.0.0:80` → container `8081`) = 301 ke HTTPS.
- `443` publik = HTTPS (sertifikat di `~/lacakedu/certs`).

Sertifikat wildcard: `bash ~/lacakedu/bin/issue-cert.sh` (butuh `~/lacakedu/acme.env`
berisi `DNS_API=dns_cf` + `CF_Token`). Detail & langkah switch DNS:
`docs/host-setup-https-direct.md`.

## Uji autostart (wajib lulus dua-duanya)
1. Reboot: `sudo reboot` → setelah boot:
   `systemctl --user is-active lacakedu-postgres.service lacakedu-redis.service lacakedu-web.service lacakedu-worker.service lacakedu-nginx.service`
   semua harus `active`, dan `curl -k https://localhost/healthz` → ok.
2. Cabut listrik: matikan paksa → nyalakan → cek sama.
   Bila gagal: `loginctl show-user $USER | grep Linger` harus `yes`.
