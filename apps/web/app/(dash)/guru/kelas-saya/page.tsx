"use client";

import { useFetch } from "@/app/lib/api";
import { PageHead, Panel, Note, Err } from "@/components/DashUI";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function GuruHome() {
  const { data, loading, error } = useFetch<{ rows: { id: string; class: { name: string }; subject: string | null }[] }>(`/api/assignments`);
  return (
    <>
      <PageHead
        kicker="Dasbor guru"
        title="Kelas yang diampu"
        desc="Daftar kelas tempatmu mengajar semester ini."
        right={<a className={buttonVariants({ variant: "sticker-ghost" })} style={{ textDecoration: "none" }} href="/change-password">Ganti kata sandi</a>}
      />
      <Panel>
        {loading && !data && (
          <div className="divide-y divide-line">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-1 py-3">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-7 w-16 rounded-full" />
              </div>
            ))}
          </div>
        )}
        {error && <Err>Gagal: {error}</Err>}
        {data && data.rows.length === 0 && <Note>Belum ada penugasan. Hubungi admin.</Note>}
        {data && data.rows.length > 0 && (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {data.rows.map((r) => (
              <li key={r.id} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "10px 14px", border: "1px solid rgba(23,23,22,.14)", borderRadius: 14 }}>
                <span className="display" style={{ fontSize: 16 }}>{r.class.name}</span>
                {r.subject && <span style={{ fontSize: 13, color: "#74746d" }}>{r.subject}</span>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
