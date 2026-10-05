// Rencana beban: ~500 scan + submission konkuren (k6). Jalankan dari mesin
// di LAN yang sama (bukan dari server) agar hasil realistis.
//
// Prasyarat: k6 terinstal (https://k6.io), 1 guru + 500 QR siswa di sekolah uji,
// BASE=https://<slug>.domainmu.id, TOKEN=sesi guru (curi dari cookie dev / login manual).
//
//   BASE=https://uji.domainmu.id TOKEN=... k6 run scripts/k6-scan.js
//   BASE=https://uji.domainmu.id TOKEN=... k6 run scripts/k6-submit.js
//
// Target keberhasilan: p95 < 800ms, error < 1%, tanpa duplikat record
// (verifikasi: SELECT count(*) ... GROUP BY studentId,date HAVING count>1 → kosong).
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "1m", target: 100 },
    { duration: "3m", target: 500 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
  },
};

const BASE = __ENV.BASE ?? "https://uji.domainmu.id";
const TOKEN = __ENV.TOKEN ?? "";
const CSRF = __ENV.CSRF ?? "";

export default function () {
  // Token QR berbeda per VU/iterasi: q_<vu>_<iter> harus diganti token asli saat uji.
  const qr = `sms1-${String(__VU).padStart(4, "0")}${String(__ITER).padStart(8, "0")}abcdef`.slice(0, 37);
  const res = http.post(
    `${BASE}/api/attendance/scan`,
    JSON.stringify({ token: qr }),
    {
      headers: {
        "content-type": "application/json",
        cookie: `__Host-session=${TOKEN}`,
        "x-csrf-token": CSRF,
      },
    },
  );
  check(res, { "scan 2xx/4xx-terkontrol": (r) => r.status !== 0 && r.status < 500 });
  sleep(0.2);
}
