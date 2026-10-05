"use client";

import { useFetch } from "@/app/lib/api";
import { PageHead, Panel, Note, Err, LinkBtn } from "@/components/DashUI";

export default function GuruHome() {
  const { data, loading, error } = useFetch<{ rows: { id: string; class: { name: string }; subject: string | null }[] }>(`/api/assignments`);
  return (
    <>
      <PageHead
        kicker="Dasbor guru"
        title="Kelas yang diampu"
        desc="Daftar kelas tempatmu mengajar semester ini."
        right={<LinkBtn href="/change-password">Ganti kata sandi</LinkBtn>}
      />
      <Panel>
        {loading && <Note>Memuat…</Note>}
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
