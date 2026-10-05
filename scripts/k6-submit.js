// Beban submission: 500 siswa kirim tugas konkuren (idempoten — rerun aman).
// Lihat k6-scan.js untuk cara pakai BASE/TOKEN/CSRF.
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
const TASK = __ENV.TASK ?? "";

export default function () {
  const res = http.post(
    `${BASE}/api/tasks/${TASK}/submit`,
    JSON.stringify({ text: `jawaban VU ${__VU} iter ${__ITER}` }),
    {
      headers: {
        "content-type": "application/json",
        cookie: `__Host-session=${TOKEN}`,
        "x-csrf-token": CSRF,
      },
    },
  );
  check(res, { "submit terkontrol": (r) => r.status !== 0 && r.status < 500 });
  sleep(0.5);
}
