"use client";

// Dashboard super-admin: agregat /api/admin/health (semua sekolah).
import { useEffect, useState } from "react";

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

  if (error) return <main><h1>Pantau</h1><p role="alert">{error}</p></main>;
  if (!h) return <main><h1>Pantau</h1><p>Memuat…</p></main>;

  return (
    <main>
      <h1>Pantau ({h.schoolCount} sekolah)</h1>
      <p>Backup: {h.backup.lastAt ?? "belum pernah"} ({h.backup.lastResult ?? "-"})</p>
      <h2>Antrean</h2>
      <ul>
        {Object.entries(h.queues).map(([q, s]) => (
          <li key={q}>{q}: tunggu {s.waiting}, gagal {s.failed}</li>
        ))}
      </ul>
      <h2>WhatsApp</h2>
      <ul>
        {(h.wa.rows ?? []).map((r) => (
          <li key={r.schoolId}>{r.slug}: {r.connected ? "terhubung" : `putus (${r.detail})`}</li>
        ))}
      </ul>
      <h2>Sekolah</h2>
      <ul>
        {h.schools.map((s) => (
          <li key={s.id}>{s.name} ({s.slug})</li>
        ))}
      </ul>
    </main>
  );
}
