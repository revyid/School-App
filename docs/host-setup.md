# Setup host (sekali saja)

loginctl enable-linger $USER

# Port rendah rootless — pilih SATU:
sudo sysctl -w net.ipv4.ip_unprivileged_port_start=80
# persisten: /etc/sysctl.d/99-rootless-ports.conf
# atau PublishPort=8080:80 + 8443:443 di .pod + redirect firewall 80→8080, 443→8443.

cp deploy/quadlet/* ~/.config/containers/systemd/
cp deploy/systemd/* ~/.config/systemd/user/
systemctl --user daemon-reload
# Start SEMUA unit container (bukan hanya pod):
systemctl --user start sms-lms-postgres.service sms-lms-redis.service
systemctl --user start sms-lms-web.service sms-lms-worker.service sms-lms-nginx.service
# Satu-satunya yang di-enable: timer sertifikat:
systemctl --user enable acme-renew.timer

# Operasi rutin: start/stop/restart saja, never enable unit Quadlet
# (autostart berasal dari blok [Install]).

## Uji autostart (wajib lulus dua-duanya)
1. Reboot: `sudo reboot` → setelah boot:
   `systemctl --user is-active sms-lms-postgres.service sms-lms-redis.service sms-lms-web.service sms-lms-worker.service sms-lms-nginx.service`
   semua harus `active`, dan `curl -k https://localhost/healthz` → ok.
2. Cabut listrik: matikan paksa → nyalakan → cek sama.
   Bila gagal: `loginctl show-user $USER | grep Linger` harus `yes`.
   Fallback terakhir: `systemctl --user enable sms-lms-pod.service` lalu ulangi uji.
