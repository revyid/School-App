"use client";

// Admin: viewer audit log (pagination cursor).
import { useState } from "react";
import { api } from "@/app/lib/api";

interface Row {
  id: string; action: string; actor: string; role: string;
  entity: string | null; entityId: string | null; ip: string | null; createdAt: string;
}

export default function AuditPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [action, setAction] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function muat(reset: boolean) {
    const c = reset ? null : cursor;
    const res = await api(`/api/audit?take=50${action ? `&action=${encodeURIComponent(action)}` : ""}${c ? `&cursor=${c}` : ""}`);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setRows(reset ? d.rows : [...rows, ...d.rows]);
      setCursor(d.nextCursor);
    }
  }

  return (
    <main>
      <h1>Audit Log</h1>
      <label>Filter aksi: <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="mis. LEAVE.REVIEW" /></label>
      <button type="button" onClick={() => muat(true)}>Muat</button>
      {msg && <p>{msg}</p>}
      <table>
        <thead><tr><th>Waktu</th><th>Aksi</th><th>Pelaku</th><th>Entitas</th><th>IP</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.createdAt.slice(0, 19).replace("T", " ")}</td>
              <td>{r.action}</td>
              <td>{r.actor} ({r.role})</td>
              <td>{r.entity ?? "-"} {r.entityId?.slice(0, 8) ?? ""}</td>
              <td>{r.ip ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {cursor && <button type="button" onClick={() => muat(false)}>Muat lagi</button>}
    </main>
  );
}
