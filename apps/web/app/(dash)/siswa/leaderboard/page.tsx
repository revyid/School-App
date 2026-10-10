"use client";

// Leaderboard EXP per kelas (semua role; guru/siswa dibatasi kelasnya server-side).
// Siswa: otomatis memakai kelas aktifnya — tanpa mengetik ID.
import { useEffect, useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Note, Err } from "@/components/DashUI";

const MEDAL = ["1", "2", "3"];

export default function LeaderboardPage() {
  const [rows, setRows] = useState<{ studentId: string; name: string; points: number }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const profile = useFetch<{ user: { studentProfile?: { class: { name: string } | null } } }>("/api/profile");

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await api("/api/exp/leaderboard");
      const d = await res.json().catch(() => ({}));
      if (!alive) return;
      setLoading(false);
      if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
      else {
        setRows(d.rows ?? []);
        setMsg((d.rows ?? []).length === 0 ? "Belum ada poin di kelas ini." : null);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <>
      <PageHead kicker="Gamifikasi" title="Leaderboard EXP" desc="Peringkat poin pengalaman per kelas. Kumpulkan XP dari tugas tepat waktu dan kehadiran." />
      <Panel>
        {(loading || profile.loading) && <Note>Memuat…</Note>}
        {profile.data?.user.studentProfile?.class && (
          <p style={{ fontSize: 13, color: "#74746d", margin: "0 0 8px" }}>
            Kelas: <strong>{profile.data.user.studentProfile.class.name}</strong>
          </p>
        )}
        {msg && (rows.length === 0 ? <Note>{msg}</Note> : <Err>{msg}</Err>)}
        {rows.length > 0 && (
          <ol style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "grid", gap: 8 }}>
            {rows.map((r, i) => (
              <li
                key={r.studentId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  borderRadius: 14,
                  background: i === 0 ? "#f5c94a" : i < 3 ? "#eeeadd" : "#fffdf8",
                  border: "1px solid rgba(23,23,22,.14)",
                  fontWeight: i < 3 ? 800 : 500,
                }}
              >
                <span style={{ width: 32, textAlign: "center" }}>{MEDAL[i] ?? `${i + 1}`}</span>
                <span style={{ flex: 1 }}>{r.name}</span>
                <span style={{ fontFamily: "var(--font-meta)", fontSize: 12 }}>{r.points} XP</span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </>
  );
}
