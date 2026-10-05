"use client";

// Dashboard super-admin: agregat /api/admin/health (semua sekolah).
import { useEffect, useState } from "react";
import { PageHead, Panel, Badge, WarmTable, warmCell, SegStat, Note, Err } from "@/components/DashUI";

interface Health {
  schoolCount: number;
  schools: { id: string; slug: string; name: string }[];
  queues: Record<string, { waiting: number; failed: number }>;
  wa: { rows?: { schoolId: string; slug: string; connected: boolean; detail: string }[] } & Record<string, unknown>;
  disk: Record<string, unknown>;
  backup: { lastAt: string | null; lastResult: string | null };
  time: string;
}

export default function PantauPage() {
  const [h, setH] = useState<Health | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/health").then(async (r) => {
      if (!r.ok) {
        setError(`Gagal memuat (${r.status})`);
        return;
      }
      setH(await r.json());
    }).catch((e) => setError(String(e)));
  }, []);

  if (error) return <Err>{error}</Err>;
  if (!h) return <Note>Memuat…</Note>;

  return (
    <>
      <PageHead
        kicker="Platform"
        title={`Pantau (${h.schoolCount} sekolah)`}
        desc={`Backup: ${h.backup.lastAt ?? "belum pernah"} (${h.backup.lastResult ?? "-"})`}
      />
      <Panel style={{ marginBottom: 16 }}>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Antrean</h2>
        <SegStat stats={Object.entries(h.queues).map(([q, s]) => ({ label: q, value: `${s.waiting} tunggu / ${s.failed} gagal` }))} />
      </Panel>
      <Panel style={{ marginBottom: 16 }}>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>WhatsApp</h2>
        {(h.wa.rows ?? []).length === 0 && <Note>Tidak ada data WA.</Note>}
        {(h.wa.rows ?? []).length > 0 && (
          <WarmTable head={["Sekolah", "Status"]}>
            {(h.wa.rows ?? []).map((r) => (
              <tr key={r.schoolId}>
                <td style={warmCell({ fontWeight: 700 })}>{r.slug}</td>
                <td style={warmCell()}><Badge status={r.connected ? "AKTIF" : "ALPHA"}>{r.connected ? "terhubung" : `putus (${r.detail})`}</Badge></td>
              </tr>
            ))}
          </WarmTable>
        )}
      </Panel>
      <Panel>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Sekolah</h2>
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, fontSize: 14 }}>
          {h.schools.map((s) => (
            <li key={s.id}>{s.name} ({s.slug})</li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
