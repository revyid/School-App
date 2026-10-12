"use client";

// Guru: detail tugas + materi utama/contoh + chart nilai + kelompok (Sheet geser custom) + nilai + pengingat (in-app + WA ortu).
import { useEffect, useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, TextSelect, Btn, Badge, WarmTable, warmCell, SegStat, Note, Err } from "@/components/DashUI";

interface Sub {
  id: string;
  studentId: string;
  text: string | null;
  link: string | null;
  fileName: string | null;
  submittedAt: string;
  isLate: boolean;
  score: number | null;
  feedback: string | null;
  student: { id: string; name: string; nisn: string | null };
}

interface Mat {
  id: string;
  kind: string;
  text: string | null;
  fileName: string | null;
  mime: string | null;
  isMain: boolean;
  isExample: boolean;
}

interface Group {
  id: string;
  name: string;
  members: { studentId: string; student: { id: string; name: string; nisn: string | null } }[];
}

interface TaskDetail {
  task: { id: string; title: string; instruction: string; type: string; deadline: string | null; allowLate: boolean; isGroup: boolean; class: { name: string } };
  visible: boolean;
  submissions: Sub[];
  pending: { id: string; name: string }[];
}

// Panel geser custom (pengganti shadcn Sheet): buat/lihat/edit kelompok.
function GroupSheet({ taskId, open, onClose }: { taskId: string; open: boolean; onClose: () => void }) {
  const groups = useFetch<{ rows: Group[]; ungrouped?: { id: string; name: string }[] }>(
    open ? `/api/tasks/${taskId}/groups` : null,
  );
  const [name, setName] = useState("");
  const [addTo, setAddTo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);

  if (!open) return null;

  async function buatGrup(e: React.FormEvent) {
    e.preventDefault();
    const res = await api(`/api/tasks/${taskId}/groups`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg(null);
      setName("");
      groups.reload();
    }
  }

  async function tambahAnggota(gid: string, studentId: string) {
    const res = await api(`/api/tasks/${taskId}/groups/${gid}/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ studentId }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg(null);
      setAddTo("");
      groups.reload();
    }
  }

  async function keluarkan(gid: string, studentId: string) {
    const res = await api(`/api/tasks/${taskId}/groups/${gid}/members?studentId=${encodeURIComponent(studentId)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error || `Gagal (${res.status})`);
    } else groups.reload();
  }

  async function hapusGrup(gid: string) {
    const res = await api(`/api/tasks/${taskId}/groups/${gid}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error || `Gagal (${res.status})`);
    } else groups.reload();
  }

  return (
    <div
      role="dialog"
      aria-label="Kelola kelompok"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(23,23,22,.45)", zIndex: 60, display: "flex", justifyContent: "flex-end" }}
    >
      <div style={{ width: "min(420px, 100vw)", height: "100%", background: "#fffdf8", overflowY: "auto", padding: 20, boxShadow: "-8px 0 24px rgba(23,23,22,.2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <h2 className="display" style={{ fontSize: 18, margin: 0, flex: 1 }}>Kelompok</h2>
          <Btn kind="ghost" type="button" onClick={onClose}>Tutup</Btn>
        </div>
        <form onSubmit={buatGrup} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama grup baru" required maxLength={100} style={{ flex: 1 }} />
          <Btn type="submit">Buat</Btn>
        </form>
        {groups.loading && <Note>Memuat…</Note>}
        {groups.error && <Err>Gagal: {groups.error}</Err>}
        {(groups.data?.rows ?? []).map((g) => (
          <div key={g.id} style={{ border: "1px solid rgba(23,23,22,.14)", borderRadius: 14, padding: 12, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <strong style={{ flex: 1 }}>{g.name}</strong>
              <span style={{ fontSize: 12, color: "#74746d" }}>{g.members.length} anggota</span>
              <Btn kind="ghost" type="button" onClick={() => hapusGrup(g.id)}>Hapus</Btn>
            </div>
            <ul style={{ margin: "0 0 8px", paddingLeft: 18, fontSize: 14, display: "grid", gap: 4 }}>
              {g.members.map((m) => (
                <li key={m.studentId} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ flex: 1 }}>{m.student.name}</span>
                  <button type="button" onClick={() => keluarkan(g.id, m.studentId)} style={{ fontSize: 12, color: "#c94b35", background: "none", border: "none", cursor: "pointer" }}>keluarkan</button>
                </li>
              ))}
              {g.members.length === 0 && <li style={{ color: "#8a8a82" }}>Belum ada anggota.</li>}
            </ul>
            {(groups.data?.ungrouped ?? []).length > 0 && (
              <div style={{ display: "flex", gap: 8 }}>
                <TextSelect value={addTo} onChange={(e) => setAddTo(e.target.value)} style={{ flex: 1 }}>
                  <option value="">— tambah siswa —</option>
                  {(groups.data?.ungrouped ?? []).map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </TextSelect>
                <Btn kind="ghost" type="button" disabled={!addTo} onClick={() => addTo && tambahAnggota(g.id, addTo)}>Tambah</Btn>
              </div>
            )}
          </div>
        ))}
        {msg && <p style={{ fontWeight: 700, color: "#c94b35" }}>{msg}</p>}
      </div>
    </div>
  );
}

function ScoreChart({ subs }: { subs: Sub[] }) {
  const scored = subs.filter((s) => s.score != null) as (Sub & { score: number })[];
  if (scored.length === 0) return <Note>Belum ada nilai untuk chart.</Note>;
  const buckets = [
    { label: "0–59", min: 0, max: 59 },
    { label: "60–69", min: 60, max: 69 },
    { label: "70–79", min: 70, max: 79 },
    { label: "80–89", min: 80, max: 89 },
    { label: "90–100", min: 90, max: 100 },
  ];
  const counts = buckets.map((b) => scored.filter((s) => s.score >= b.min && s.score <= b.max).length);
  const max = Math.max(...counts, 1);
  const avg = Math.round(scored.reduce((a, s) => a + s.score, 0) / scored.length);
  return (
    <div>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: "#575752" }}>
        {scored.length} dinilai · rata-rata <strong>{avg}</strong>
      </p>
      <div style={{ display: "grid", gap: 8 }}>
        {buckets.map((b, i) => (
          <div key={b.label} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13 }}>
            <span style={{ width: 64, color: "#74746d" }}>{b.label}</span>
            <div style={{ flex: 1, background: "#eeeadd", borderRadius: 8, height: 18, overflow: "hidden" }}>
              <div style={{ width: `${Math.round((counts[i] / max) * 100)}%`, height: "100%", background: "#50643e", borderRadius: 8 }} />
            </div>
            <span style={{ width: 28, textAlign: "right", fontWeight: 700 }}>{counts[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GuruTugasDetail({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  useState(() => {
    void params.then((p) => setId(p.id));
  });
  const detail = useFetch<TaskDetail>(id ? `/api/tasks/${id}` : null);
  const mats = useFetch<{ rows: Mat[] }>(id ? `/api/tasks/${id}/materials` : null);
  const [grades, setGrades] = useState<Record<string, { score: string; feedback: string }>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  // Form materi.
  const [mKind, setMKind] = useState("TEXT");
  const [mText, setMText] = useState("");
  const [mFile, setMFile] = useState<File | null>(null);
  const [mMain, setMMain] = useState(false);
  const [mExample, setMExample] = useState(false);

  async function nilai(subId: string) {
    const g = grades[subId];
    if (!g?.score) return;
    const res = await api(`/api/submissions/${subId}/grade`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ score: Number(g.score), feedback: g.feedback || null }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg("Nilai tersimpan");
      detail.reload();
    }
  }

  async function ingatkan(kind: "reminder" | "thanks") {
    if (!id) return;
    const res = await api("/api/tasks/nudge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId: id, kind }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else setMsg(`Terkirim: ${d.inapp} in-app + ${d.wa} WA ortu`);
  }

  async function tambahMateri(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    let res: Response;
    if (mKind === "TEXT") {
      res = await api(`/api/tasks/${id}/materials`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "TEXT", text: mText, isMain: mMain, isExample: mExample }),
      });
    } else {
      if (!mFile) { setMsg("Pilih file dulu"); return; }
      const form = new FormData();
      form.append("kind", mKind);
      form.append("file", mFile);
      form.append("isMain", mMain ? "1" : "0");
      form.append("isExample", mExample ? "1" : "0");
      res = await api(`/api/tasks/${id}/materials`, { method: "POST", body: form });
    }
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg("Materi ditambahkan");
      setMText("");
      setMFile(null);
      setMMain(false);
      setMExample(false);
      mats.reload();
    }
  }

  if (!detail.data && detail.loading) return <Note>Memuat…</Note>;
  if (detail.error) return <Err>Gagal: {detail.error}</Err>;
  if (!detail.data) return <Note>Memuat…</Note>;
  const t = detail.data;
  const main = (mats.data?.rows ?? []).filter((m) => m.isMain);
  const examples = (mats.data?.rows ?? []).filter((m) => m.isExample && !m.isMain);
  const others = (mats.data?.rows ?? []).filter((m) => !m.isMain && !m.isExample);
  return (
    <>
      <PageHead
        kicker="Tugas"
        title={t.task.title}
        desc={`Kelas: ${t.task.class.name} · Kategori: ${t.task.type}`}
        right={<Badge status={t.visible ? "AKTIF" : "PENDING"}>{t.visible ? "Terlihat siswa" : "Terjadwal/belum publish"}</Badge>}
      />
      <Panel style={{ marginBottom: 16 }}>
        <p style={{ margin: "0 0 12px", whiteSpace: "pre-wrap" }}>{t.task.instruction}</p>
        <SegStat stats={[
          { label: "Terkumpul", value: t.submissions.length },
          { label: "Belum", value: t.pending.length },
        ]} />
        <Toolbar>
          <Btn type="button" onClick={() => ingatkan("reminder")}>Kirim pengingat ke yang belum mengumpulkan</Btn>
          <Btn kind="ghost" type="button" onClick={() => ingatkan("thanks")}>Kirim terima kasih ke yang sudah mengumpulkan</Btn>
          {t.task.isGroup && <Btn kind="dark" type="button" onClick={() => setSheet(true)}>Kelola kelompok</Btn>}
        </Toolbar>
        {msg && <p style={{ fontWeight: 700 }}>{msg}</p>}
      </Panel>
      <Panel style={{ marginBottom: 16 }}>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Materi utama</h2>
        {main.length === 0 && <Note>Belum ada materi utama. Tandai materi sebagai utama saat menambah di bawah.</Note>}
        {main.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, fontSize: 14 }}>
            {main.map((m) => (
              <li key={m.id}>
                {m.kind === "TEXT" ? m.text : <a href={`/api/task-files/${t.task.id}/${m.fileName}`}>Unduh lampiran utama ({m.mime})</a>}
                {m.isExample && <Badge status="CONTOH">Contoh</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel style={{ marginBottom: 16 }}>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Contoh per kategori ({t.task.type})</h2>
        {examples.length === 0 && <Note>Belum ada contoh untuk kategori ini.</Note>}
        {examples.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, fontSize: 14 }}>
            {examples.map((m) => (
              <li key={m.id}>
                {m.kind === "TEXT" ? m.text : <a href={`/api/task-files/${t.task.id}/${m.fileName}`}>Unduh contoh ({m.mime})</a>}
              </li>
            ))}
          </ul>
        )}
        {others.length > 0 && (
          <>
            <h3 className="display" style={{ fontSize: 15, margin: "14px 0 8px" }}>Materi pendukung lain</h3>
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, fontSize: 14 }}>
              {others.map((m) => (
                <li key={m.id}>
                  {m.kind === "TEXT" ? m.text : <a href={`/api/task-files/${t.task.id}/${m.fileName}`}>Unduh lampiran ({m.mime})</a>}
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
      <Panel style={{ marginBottom: 16 }}>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Tambah materi</h2>
        <form onSubmit={tambahMateri} style={{ display: "grid", gap: 12, maxWidth: 560 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Jenis:
            <TextSelect value={mKind} onChange={(e) => setMKind(e.target.value)}>
              <option value="TEXT">Teks</option>
              <option value="FILE">File</option>
              <option value="IMAGE">Gambar</option>
            </TextSelect>
          </label>
          {mKind === "TEXT" ? (
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
              Isi materi:
              <textarea value={mText} onChange={(e) => setMText(e.target.value)} required rows={3} style={{ borderRadius: 14, border: "1px solid rgba(23,23,22,.25)", background: "#fffdf8", padding: "9px 14px", fontSize: 14 }} />
            </label>
          ) : (
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
              File:
              <input type="file" onChange={(e) => setMFile(e.target.files?.[0] ?? null)} />
            </label>
          )}
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
            <input type="checkbox" checked={mMain} onChange={(e) => setMMain(e.target.checked)} /> Materi utama
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
            <input type="checkbox" checked={mExample} onChange={(e) => setMExample(e.target.checked)} /> Contoh untuk kategori {t.task.type}
          </label>
          <Toolbar><Btn type="submit">Tambah materi</Btn></Toolbar>
        </form>
      </Panel>
      <Panel style={{ marginBottom: 16 }}>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Chart nilai</h2>
        <ScoreChart subs={t.submissions} />
      </Panel>
      <Panel style={{ marginBottom: 16 }}>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Pengumpulan</h2>
        {t.submissions.length === 0 && <Note>Belum ada yang mengumpulkan.</Note>}
        {t.submissions.length > 0 && (
          <WarmTable head={["Nama", "Waktu", "Terlambat", "File/Link", "Nilai", "Beri nilai"]}>
            {t.submissions.map((s) => (
              <tr key={s.id}>
                <td style={warmCell({ fontWeight: 700 })}>{s.student.name}</td>
                <td style={warmCell({ whiteSpace: "nowrap" })}>{new Date(s.submittedAt).toLocaleString("id-ID")}</td>
                <td style={warmCell()}>{s.isLate ? <Badge status="TERLAMBAT">Ya</Badge> : "Tidak"}</td>
                <td style={warmCell()}>
                  {s.fileName && <a href={`/api/task-files/${t.task.id}/${s.fileName}`}>unduh</a>}
                  {s.link && <> <a href={s.link} target="_blank" rel="noreferrer">tautan</a></>}
                  {s.text && <span> (teks)</span>}
                </td>
                <td style={warmCell({ fontWeight: 700 })}>{s.score ?? "-"}</td>
                <td style={warmCell()}>
                  <span style={{ display: "flex", gap: 6, flexWrap: "wrap", flexDirection: "row" }}>
                    <TextInput
                      type="number" min={0} max={100} placeholder="0-100" style={{ width: 80 }}
                      value={grades[s.id]?.score ?? ""}
                      onChange={(e) => setGrades({ ...grades, [s.id]: { score: e.target.value, feedback: grades[s.id]?.feedback ?? "" } })}
                    />
                    <TextInput
                      placeholder="umpan balik" style={{ minWidth: 120, flex: 1 }}
                      value={grades[s.id]?.feedback ?? ""}
                      onChange={(e) => setGrades({ ...grades, [s.id]: { score: grades[s.id]?.score ?? "", feedback: e.target.value } })}
                    />
                    <Btn kind="ghost" type="button" onClick={() => nilai(s.id)}>Simpan</Btn>
                  </span>
                </td>
              </tr>
            ))}
          </WarmTable>
        )}
      </Panel>
      <Panel>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Belum mengumpulkan ({t.pending.length})</h2>
        {t.pending.length === 0 && <Note>Semua sudah mengumpulkan.</Note>}
        {t.pending.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, fontSize: 14 }}>
            {t.pending.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>
        )}
      </Panel>
      <GroupSheet taskId={t.task.id} open={sheet} onClose={() => setSheet(false)} />
    </>
  );
}
