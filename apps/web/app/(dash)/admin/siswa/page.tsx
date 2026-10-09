"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import JSZip from "jszip";
import { api, useFetch } from "@/app/lib/api";
import {
  PageHead,
  Panel,
  Toolbar,
  TextInput,
  TextSelect,
  Btn,
  Badge,
  WarmTable,
  warmCell,
  Note,
  Err,
  LinkBtn,
} from "@/components/DashUI";

interface StudentRow {
  userId: string;
  classId: string | null;
  parentPhone: string | null;
  gender: string | null;
  user: {
    id: string;
    name: string;
    nisn: string | null;
    email: string | null;
    isActive: boolean;
  };
  class: { id: string; name: string } | null;
}

// Render kartu QR siswa ke Canvas -> PNG Blob
async function renderCardCanvas(
  card: { name: string; nisn: string; className: string; qrToken: string },
  schoolName: string
): Promise<Blob> {
  const qrDataUrl = await QRCode.toDataURL(card.qrToken, {
    width: 320,
    margin: 1,
    errorCorrectionLevel: "M",
  });
  const qrImg = new Image();
  await new Promise((resolve, reject) => {
    qrImg.onload = resolve;
    qrImg.onerror = reject;
    qrImg.src = qrDataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 860;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, 600, 860);

  // Border frame luar
  ctx.strokeStyle = "#171716";
  ctx.lineWidth = 6;
  ctx.strokeRect(16, 16, 568, 828);

  // Border frame dalam
  ctx.strokeStyle = "rgba(23,23,22,0.15)";
  ctx.lineWidth = 2;
  ctx.strokeRect(26, 26, 548, 808);

  // Header banner oranye
  ctx.fillStyle = "#e85e43";
  ctx.fillRect(28, 28, 544, 95);

  // Nama Sekolah & Judul
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(schoolName.toUpperCase(), 300, 70);

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText("KARTU IDENTITAS & PRESENSI SISWA", 300, 98);

  // Box putih tempat QR Code
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#171716";
  ctx.lineWidth = 3;
  ctx.fillRect(140, 150, 320, 320);
  ctx.strokeRect(140, 150, 320, 320);

  // Gambar QR Code
  ctx.drawImage(qrImg, 150, 160, 300, 300);

  // Nama Siswa
  ctx.fillStyle = "#171716";
  ctx.font = "bold 30px sans-serif";
  ctx.fillText(card.name, 300, 525);

  // Badge Kelas
  ctx.fillStyle = "#aec6a4";
  ctx.fillRect(180, 555, 240, 42);
  ctx.strokeStyle = "#171716";
  ctx.lineWidth = 2;
  ctx.strokeRect(180, 555, 240, 42);
  ctx.fillStyle = "#171716";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText(`KELAS: ${card.className}`, 300, 582);

  // Nomor NISN
  ctx.fillStyle = "#171716";
  ctx.font = "bold 20px monospace";
  ctx.fillText(`NISN: ${card.nisn}`, 300, 638);

  // Petunjuk
  ctx.fillStyle = "#74746d";
  ctx.font = "14px sans-serif";
  ctx.fillText("Pindai QR ini pada scanner guru/sekolah", 300, 715);
  ctx.fillText("untuk mencatat kehadiran otomatis.", 300, 738);

  // Footer
  ctx.fillStyle = "#f5c94a";
  ctx.fillRect(28, 775, 544, 45);
  ctx.fillStyle = "#171716";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText("SMS-LMS • PRESENSI & PORTAL SISWA DIGITAL", 300, 803);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/png");
  });
}

export default function StudentsPage() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [classId, setClassId] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(q);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  const qs = new URLSearchParams({
    page: String(page),
    perPage: "20",
    q: debounced,
    ...(classId ? { classId } : {}),
  });

  const { data, loading, error, reload } = useFetch<{
    rows: StudentRow[];
    total: number;
    page: number;
    perPage: number;
  }>(`/api/students?${qs}`);

  const { data: classes } = useFetch<{ rows: { id: string; name: string }[] }>(
    `/api/classes?page=1&perPage=100`
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;

  // Form Tambah Siswa Baru (1 per 1)
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNisn, setNewNisn] = useState("");
  const [newClassId, setNewClassId] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newGender, setNewGender] = useState<"L" | "P">("L");
  const [createdPw, setCreatedPw] = useState<{ name: string; pw: string } | null>(null);
  const [submittingStudent, setSubmittingStudent] = useState(false);

  // Edit Siswa
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editClass, setEditClass] = useState("");
  const [editPhone, setEditPhone] = useState("");

  // Download ZIP state
  const [zipLoading, setZipLoading] = useState(false);
  const [zipProgress, setZipProgress] = useState<string | null>(null);

  async function createSingleStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newNisn.trim()) {
      alert("Nama lengkap dan NISN wajib diisi");
      return;
    }
    setSubmittingStudent(true);
    try {
      const res = await api("/api/students/single", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          nisn: newNisn.trim(),
          classId: newClassId || null,
          parentPhone: newPhone.trim() || null,
          gender: newGender || null,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert("Gagal menambah siswa: " + (d.error || res.status));
        return;
      }
      setCreatedPw({ name: newName.trim(), pw: d.tempPassword });
      setNewName("");
      setNewNisn("");
      setNewPhone("");
      reload();
    } finally {
      setSubmittingStudent(false);
    }
  }

  function startEdit(row: StudentRow) {
    setEditing(row);
    setEditName(row.user.name);
    setEditClass(row.classId ?? "");
    setEditPhone(row.parentPhone ?? "");
  }

  async function saveEdit() {
    if (!editing) return;
    const res = await api(`/api/students/${editing.userId}`, {
      method: "PATCH",
      csrf: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: editName.trim(),
        classId: editClass || null,
        parentPhone: editPhone.trim() || null,
      }),
    });
    if (!res.ok) {
      alert("Gagal: " + ((await res.json().catch(() => ({}))).error || res.status));
      return;
    }
    setEditing(null);
    reload();
  }

  async function toggleActive(row: StudentRow) {
    if (!confirm(`${row.user.isActive ? "Nonaktifkan" : "Aktifkan"} ${row.user.name}?`)) return;
    const res = await api(`/api/students/${row.userId}`, {
      method: "PATCH",
      csrf: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !row.user.isActive }),
    });
    if (!res.ok) alert("Gagal: " + ((await res.json().catch(() => ({}))).error || res.status));
    reload();
  }

  async function resetPw(row: StudentRow) {
    if (!confirm(`Reset password ${row.user.name}?`)) return;
    const res = await api(`/api/students/${row.userId}/reset-password`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert("Gagal reset password: " + (d.error || res.status));
      return;
    }
    setCreatedPw({ name: row.user.name, pw: d.tempPassword });
  }

  // Unduh 1 Kartu QR sebagai PNG
  async function downloadSingleCard(r: StudentRow) {
    try {
      const qrRes = await api(`/api/attendance/qr?studentId=${r.userId}`);
      const qrData = await qrRes.json();
      if (!qrRes.ok || !qrData?.qr?.token) {
        alert("Gagal memuat token QR siswa");
        return;
      }
      const blob = await renderCardCanvas(
        {
          name: r.user.name,
          nisn: r.user.nisn ?? "-",
          className: r.class?.name ?? "Umum",
          qrToken: qrData.qr.token,
        },
        "Sekolah Demo"
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Kartu_QR_${r.user.nisn ?? "siswa"}_${r.user.name}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Gagal mengunduh kartu: " + (e as Error).message);
    }
  }

  // Unduh Semua Kartu QR sebagai file .ZIP
  async function downloadAllCardsZip() {
    setZipLoading(true);
    setZipProgress("Mengambil data kartu siswa…");
    try {
      const url = `/api/students/qr-cards${classId ? `?classId=${classId}` : ""}`;
      const res = await api(url);
      const data = await res.json();
      const rows = data.rows ?? [];
      if (rows.length === 0) {
        alert("Tidak ada data siswa untuk diunduh.");
        return;
      }

      const zip = new JSZip();
      for (let i = 0; i < rows.length; i++) {
        setZipProgress(`Merender kartu ${i + 1} dari ${rows.length}…`);
        const item = rows[i];
        const blob = await renderCardCanvas(item, data.schoolName || "Sekolah");
        const safeName = item.name.replace(/[^a-zA-Z0-9_-]/g, "_");
        zip.file(`${item.className}_${item.nisn}_${safeName}.png`, blob);
      }

      setZipProgress("Mengemas ke dalam file .ZIP…");
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const dlUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = dlUrl;
      const label = classId ? `Kelas_${classes?.rows.find((c) => c.id === classId)?.name ?? "Pilihan"}` : "Semua_Siswa";
      a.download = `Kartu_QR_Siswa_${label}.zip`;
      a.click();
      URL.revokeObjectURL(dlUrl);
    } catch (err) {
      alert("Gagal mengunduh ZIP: " + (err as Error).message);
    } finally {
      setZipLoading(false);
      setZipProgress(null);
    }
  }

  return (
    <>
      <PageHead
        kicker="Data master"
        title="Daftar Siswa & Kartu QR"
        desc={`Total ${data?.total ?? "…"} siswa terdaftar. Tambah 1 per 1, unduh batch kartu QR (.ZIP), atau filter per kelas.`}
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn kind="primary" onClick={() => setShowAddForm((s) => !s)}>
              {showAddForm ? "Tutup Form Siswa" : "+ Tambah Siswa (1 per 1)"}
            </Btn>
            <Btn
              kind="dark"
              onClick={downloadAllCardsZip}
              disabled={zipLoading}
              style={{ background: "#50643e", borderColor: "#50643e", color: "#fffdf8" }}
            >
              {zipLoading ? (zipProgress ?? "Memproses…") : "Unduh Kartu QR (.ZIP) 📦"}
            </Btn>
            <LinkBtn href="/admin/import">Import Excel</LinkBtn>
          </div>
        }
      />

      {/* Notifikasi password sementara setelah tambah siswa */}
      {createdPw && (
        <div
          style={{
            background: "#f5c94a",
            color: "#171716",
            padding: "14px 18px",
            borderRadius: 14,
            fontWeight: 700,
            marginBottom: 16,
            border: "2px solid #171716",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            Siswa <strong>{createdPw.name}</strong> berhasil didaftarkan! Password login sementara:{" "}
            <code style={{ background: "#fffdf8", padding: "3px 8px", borderRadius: 6, fontSize: 16 }}>
              {createdPw.pw}
            </code>
          </div>
          <Btn kind="ghost" onClick={() => setCreatedPw(null)}>✕</Btn>
        </div>
      )}

      {/* Form Tambah Siswa Baru (1 per 1) */}
      {showAddForm && (
        <Panel style={{ marginBottom: 20, border: "2px solid #e85e43", background: "#fffdf8" }}>
          <h2 className="display" style={{ fontSize: 19, margin: "0 0 14px" }}>
            Tambah Siswa Baru (1 per 1)
          </h2>
          <form onSubmit={createSingleStudent} style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
                Nama Lengkap Siswa *:
                <TextInput
                  placeholder="Contoh: Muhammad Rizky"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </label>

              <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
                NISN (Nomor Induk Siswa Nasional) *:
                <TextInput
                  placeholder="Contoh: 0012345678"
                  value={newNisn}
                  onChange={(e) => setNewNisn(e.target.value)}
                  required
                />
              </label>

              <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
                Kelas:
                <TextSelect value={newClassId} onChange={(e) => setNewClassId(e.target.value)}>
                  <option value="">Pilih Kelas</option>
                  {classes?.rows.map((c) => (
                    <option key={c.id} value={c.id}>
                      Kelas {c.name}
                    </option>
                  ))}
                </TextSelect>
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
                No HP WhatsApp Orang Tua (Opsional):
                <TextInput
                  placeholder="08123456789 atau 628..."
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />
              </label>

              <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
                Jenis Kelamin:
                <TextSelect
                  value={newGender}
                  onChange={(e) => setNewGender(e.target.value as "L" | "P")}
                >
                  <option value="L">Laki-laki (L)</option>
                  <option value="P">Perempuan (P)</option>
                </TextSelect>
              </label>

              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <Btn type="submit" disabled={submittingStudent} style={{ width: "100%", minHeight: 44 }}>
                  {submittingStudent ? "Mendaftarkan…" : "+ Daftarkan Siswa & Buat QR"}
                </Btn>
              </div>
            </div>
          </form>
        </Panel>
      )}

      {/* Tabel Siswa */}
      <Panel>
        <Toolbar>
          <TextInput
            placeholder="Cari nama / NISN…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 260 }}
          />
          <TextSelect
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Semua kelas</option>
            {classes?.rows.map((c) => (
              <option key={c.id} value={c.id}>
                Kelas {c.name}
              </option>
            ))}
          </TextSelect>
        </Toolbar>

        {loading && <Note>Memuat data siswa…</Note>}
        {error && <Err>Error: {error}</Err>}
        {data && data.rows.length === 0 && <Note>Tidak ada siswa yang cocok.</Note>}
        {data && data.rows.length > 0 && (
          <>
            <WarmTable head={["Nama Siswa", "NISN", "Kelas", "No Ortu", "Status", "Aksi Kartu & Akun"]}>
              {data.rows.map((r) => (
                <tr key={r.userId}>
                  <td style={warmCell({ fontWeight: 700 })}>{r.user.name}</td>
                  <td style={warmCell()}>{r.user.nisn ?? "-"}</td>
                  <td style={warmCell()}>{r.class?.name ?? "-"}</td>
                  <td style={warmCell()}>{r.parentPhone ?? "-"}</td>
                  <td style={warmCell()}>
                    <Badge status={r.user.isActive ? "AKTIF" : "NONAKTIF"}>
                      {r.user.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td style={warmCell()}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <Btn
                        kind="ghost"
                        onClick={() => downloadSingleCard(r)}
                        title="Unduh PNG Kartu QR dengan Nama, Kelas, NISN"
                      >
                        Unduh QR (PNG) 🖨️
                      </Btn>
                      <Btn kind="ghost" onClick={() => startEdit(r)}>
                        Edit
                      </Btn>
                      <Btn kind="ghost" onClick={() => resetPw(r)}>
                        Reset PW
                      </Btn>
                      <Btn kind="ghost" onClick={() => toggleActive(r)}>
                        {r.user.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </WarmTable>

            <Toolbar>
              <Btn kind="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ‹ Sebelumnya
              </Btn>
              <span style={{ fontSize: 13, color: "#74746d" }}>
                Halaman {page}/{totalPages}
              </span>
              <Btn kind="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Berikutnya ›
              </Btn>
            </Toolbar>
          </>
        )}
      </Panel>

      {/* Modal Edit Siswa */}
      {editing && (
        <div
          role="dialog"
          aria-label="Edit siswa"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(23,23,22,.45)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: "#fffdf8",
              borderRadius: 20,
              padding: 22,
              minWidth: 320,
              display: "grid",
              gap: 12,
              border: "2px solid #171716",
            }}
          >
            <h2 className="display" style={{ margin: 0, fontSize: 20 }}>
              Edit Siswa: {editing.user.name}
            </h2>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
              Nama Lengkap:
              <TextInput value={editName} onChange={(e) => setEditName(e.target.value)} />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
              Kelas:
              <TextSelect value={editClass} onChange={(e) => setEditClass(e.target.value)}>
                <option value="">Tanpa kelas</option>
                {classes?.rows.map((c) => (
                  <option key={c.id} value={c.id}>
                    Kelas {c.name}
                  </option>
                ))}
              </TextSelect>
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
              Nomor WhatsApp Ortu:
              <TextInput
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="08... atau 628..."
              />
            </label>
            <Toolbar>
              <Btn onClick={saveEdit}>Simpan Perubahan</Btn>
              <Btn kind="ghost" onClick={() => setEditing(null)}>
                Batal
              </Btn>
            </Toolbar>
          </div>
        </div>
      )}
    </>
  );
}
