# Penanganan dan rotasi secret deployment

`apps/web/.env.local` pernah tercatat dalam Git. File telah dikeluarkan dari index pada perubahan ini dan di-ignore untuk commit berikutnya; salinan lokal tidak dihapus. Menghapus file pada commit terbaru **tidak** menghapus blob dari riwayat Git, jadi perlakukan nilai yang pernah tersimpan sebagai berpotensi terekspos sampai pemilik deployment memverifikasi dan merotasinya.

## Tindakan untuk pemilik deployment

1. Periksa secret manager/deployment yang sebenarnya—jangan menyalin nilai secret ke chat, issue, log build, atau commit.
2. Jika nilainya aktif, rotasi kredensial PostgreSQL `app_user` dan `app_system`; perbarui secret `DATABASE_URL` dan `SYSTEM_URL` pada deployment, lalu verifikasi aplikasi dan backup tetap berfungsi.
3. Rotasi `INTERNAL_TOKEN` pada web dan worker secara bersamaan.
4. Rotasi `VAPID_PRIVATE` bila pernah dipakai untuk mengirim push; perbarui pasangan public/private di deployment agar subscription lama dapat ditangani sesuai kebijakan aplikasi.
5. Rotasi key penyedia AI, secret sesi/JWT, atau credential lain yang ternyata pernah berada dalam file tersebut.
6. Setelah secret baru aktif dan layanan terverifikasi, cabut/revoke nilai lama. Jangan melakukan penghapusan riwayat Git atau force-push secara otomatis; bila pembersihan riwayat diperlukan, koordinasikan dengan semua pemakai repo karena perubahan itu menulis ulang commit.

File `.env.example` hanya berisi nama variabel dan placeholder. Nilai runtime harus disimpan di secret manager, bukan di repository.
