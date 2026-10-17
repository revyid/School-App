"use client";

// Leaderboard EXP per kelas (semua role; guru/siswa dibatasi kelasnya server-side).
// Siswa: otomatis memakai kelas aktifnya — tanpa mengetik ID.
import { useEffect, useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

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
      <Card>
        {(loading || profile.loading) && <Alert>Memuat…</Alert>}
        {profile.data?.user.studentProfile?.class && (
          <p className="text-[13px] text-muted mt-0 mr-0 mb-2 ml-0">
            Kelas: <strong>{profile.data.user.studentProfile.class.name}</strong>
          </p>
        )}
        {msg && (rows.length === 0 ? <Alert>{msg}</Alert> : <Alert variant="destructive">{msg}</Alert>)}
        {rows.length > 0 && (
          <ol className="list-none mt-2 mr-0 mb-0 ml-0 p-0 grid gap-2">
            {rows.map((r, i) => (
              <li
                key={r.studentId}
                className={cn(
                  "flex items-center gap-3 px-[14px] py-[10px] rounded-[14px] border border-line",
                  i === 0 ? "bg-sun font-extrabold" : i < 3 ? "bg-paper-deep font-extrabold" : "bg-cream font-medium",
                )}
              >
                <span className="w-[32px] text-center">{MEDAL[i] ?? `${i + 1}`}</span>
                <span className="flex-1">{r.name}</span>
                <span className="font-meta text-xs">{r.points} XP</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  );
}
