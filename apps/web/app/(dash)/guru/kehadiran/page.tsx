"use client";

// Rekap kehadiran harian per kelas (guru: hanya kelasnya — server menolak yang lain).
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, TextSelect, Btn, Badge, WarmTable, warmCell, SegStat, Note, Err, LinkBtn } from "@/components/DashUI";

interface Row {
  studentId: string;
  name: string;
  nisn: string | null;
  record: { status: string; source: string; scannedAt: string | null; note: string | null } | null;
}

function todayStr(): string {
  const n = new Date(Date.now() + 7 * 3600 * 1000);
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-${String(n.getUTCDate()).padStart(2, "0")}`;
}

export default function KehadiranPage() {
  const [date, setDate] = useState(todayStr());
  const classes = useFetch<{ rows: { id: string; class: { id: string; name: string } }[] }>("/api/assignments");
  const [classId, setClassId] = useState("");
  const kelasUnik = (classes.data?.rows ?? []).filter(
    (r, i, a) => a.findIndex((x) => x.class.id === r.class.id) === i,
  );
  const daily = useFetch<{ rows: Row[]; summary: Record<string, number> }>(
    classId ? `/api/attendance/daily?date=${date}&classId=${classId}` : null,
  );
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  async function saveManual(studentId: string) {
    const status = edit[studentId];
    if (!status) return;
    const res = await api("/api/attendance/manual", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ studentId, date, status }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg(`Tersimpan: ${status}`);
      daily.reload();
    }
  }

  const s = daily.data?.summary;
  return (
    <>
      <PageHead
        kicker="Absensi"
        title="Kehadiran harian"
        desc="Pilih tanggal dan kelas, lalu tandai manual bila ada yang terlewat scan."
        right={<LinkBtn href="/guru/scanner">Buka scanner</LinkBtn>}
      />
      <Panel style={{ marginBottom: 16 }}>
        <Toolbar>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#74746d" }}>
            Tanggal: <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "auto" }} />
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#74746d" }}>
            Kelas:
            <TextSelect value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">— pilih —</option>
              {kelasUnik.map((r) => (
                <option key={r.class.id} value={r.class.id}>{r.class.name}</option>
              ))}
            </TextSelect>
          </label>
        </Toolbar>
        {s && (
          <SegStat stats={[
            { label: "Hadir", value: s.HADIR ?? 0 },
            { label: "Izin", value: s.IZIN ?? 0 },
            { label: "Sakit", value: s.SAKIT ?? 0 },
            { label: "Alpha", value: s.ALPHA ?? 0 },
            { label: "Belum tercatat", value: s.BELUM ?? 0 },
          ]} />
        )}
        {msg && <p style={{ fontWeight: 700 }}>{msg}</p>}
        {daily.loading && <Note>Memuat…</Note>}
        {daily.error && <Err>Gagal: {daily.error}</Err>}
        {daily.data && (
          <WarmTable head={["Nama", "NISN", "Status", "Ubah manual"]}>
            {daily.data.rows.map((r) => (
              <tr key={r.studentId}>
                <td style={warmCell({ fontWeight: 700 })}>{r.name}</td>
                <td style={warmCell()}>{r.nisn ?? "-"}</td>
                <td style={warmCell()}>
                  {r.record ? <><Badge status={r.record.status} /> <span style={{ fontSize: 12, color: "#74746d" }}>({r.record.source})</span></> : <Badge status="BELUM" />}
                </td>
                <td style={warmCell()}>
                  <span style={{ display: "flex", gap: 6 }}>
                    <TextSelect value={edit[r.studentId] ?? ""} onChange={(e) => setEdit({ ...edit, [r.studentId]: e.target.value })}>
                      <option value="">—</option>
                      <option value="HADIR">HADIR</option>
                      <option value="IZIN">IZIN</option>
                      <option value="SAKIT">SAKIT</option>
                      <option value="ALPHA">ALPHA</option>
                    </TextSelect>
                    <Btn kind="ghost" type="button" onClick={() => saveManual(r.studentId)}>Simpan</Btn>
                  </span>
                </td>
              </tr>
            ))}
          </WarmTable>
        )}
      </Panel>
    </>
  );
}
