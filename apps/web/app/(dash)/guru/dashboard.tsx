"use client";

// Dasbor guru: kelas diampu, tugas aktif, rekap absensi hari ini (kelas pertama).
import { useFetch } from "@/app/lib/api";

function todayStr(): string {
  const n = new Date(Date.now() + 7 * 3600 * 1000);
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-${String(n.getUTCDate()).padStart(2, "0")}`;
}

export default function GuruDashboard() {
  const assign = useFetch<{ rows: { id: string; class: { name: string } }[] }>("/api/assignments");
  const tasks = useFetch<{ rows: { id: string }[] }>("/api/tasks");
  const firstClass = assign.data?.rows[0]?.id ?? "";
  const daily = useFetch<{ summary: Record<string, number> }>(
    firstClass ? `/api/attendance/daily?date=${todayStr()}&classId=${firstClass}` : null,
  );
  const hadir = daily.data?.summary;

  return (
    <div>
      <ul>
        <li>Kelas diampu: {assign.data ? assign.data.rows.length : "…"}</li>
        <li>Tugas aktif: {tasks.data ? tasks.data.rows.length : "…"}</li>
        <li>
          Absensi hari ini{assign.data?.rows[0] ? ` (${assign.data.rows[0].class.name})` : ""}:{" "}
          {hadir ? `Hadir ${hadir.HADIR}, Izin ${hadir.IZIN}, Sakit ${hadir.SAKIT}, Alpha ${hadir.ALPHA}, Belum ${hadir.BELUM}` : "…"}
        </li>
      </ul>
      <p>
        <a href="/guru/tugas">Tugas</a> · <a href="/guru/scanner">Scanner</a> ·{" "}
        <a href="/guru/kehadiran">Kehadiran</a> · <a href="/guru/kelas-saya">Kelas saya</a>
      </p>
    </div>
  );
}
