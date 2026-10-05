"use client";

// Admin: viewer audit log (pagination cursor).
import { useState } from "react";
import { api } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, Btn, WarmTable, warmCell, Note, Err } from "@/components/DashUI";

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
    <>
      <PageHead kicker="Keamanan" title="Audit log" desc="Jejak append-only semua aksi penting di sekolah ini." />
      <Panel>
        <Toolbar>
          <TextInput value={action} onChange={(e) => setAction(e.target.value)} placeholder="Filter aksi, mis. LEAVE.REVIEW" style={{ maxWidth: 300 }} />
          <Btn type="button" onClick={() => muat(true)}>Muat</Btn>
        </Toolbar>
        {msg && <Err>{msg}</Err>}
        {rows.length === 0 && <Note>Belum ada baris. Tekan Muat untuk menampilkan.</Note>}
        {rows.length > 0 && (
          <WarmTable head={["Waktu", "Aksi", "Pelaku", "Entitas", "IP"]}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={warmCell({ whiteSpace: "nowrap", fontFamily: "var(--font-meta)", fontSize: 12 })}>{r.createdAt.slice(0, 19).replace("T", " ")}</td>
                <td style={warmCell({ fontWeight: 700 })}>{r.action}</td>
                <td style={warmCell()}>{r.actor} ({r.role})</td>
                <td style={warmCell()}>{r.entity ?? "-"} {r.entityId?.slice(0, 8) ?? ""}</td>
                <td style={warmCell()}>{r.ip ?? "-"}</td>
              </tr>
            ))}
          </WarmTable>
        )}
        {cursor && <Toolbar><Btn kind="ghost" type="button" onClick={() => muat(false)}>Muat lagi</Btn></Toolbar>}
      </Panel>
    </>
  );
}
