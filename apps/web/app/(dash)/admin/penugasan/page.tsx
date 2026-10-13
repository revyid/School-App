"use client";

import { useFetch } from "@/app/lib/api";
import { PageHead, Panel, Note, Err, LinkBtn, WarmTable, warmCell } from "@/components/DashUI";

export default function AssignmentsPage() {
  const { data, loading, error } = useFetch<{ rows: { id: string; subject: string | null; teacher: { id: string; name: string }; class: { id: string; name: string } }[] }>(`/api/assignments`);

  return (
    <>
      <PageHead
        kicker="Data master"
        title="Penugasan guru-kelas"
        desc="Daftar penugasan dibaca langsung dari jadwal — tidak perlu dikelola manual."
        right={<LinkBtn href="/admin/jadwal">Atur di Jadwal</LinkBtn>}
      />
      <Panel>
        {loading && <Note>Memuat…</Note>}
        {error && <Err>Error: {error}</Err>}
        {data && data.rows.length === 0 && <Note>Belum ada penugasan. Buat slot jadwal dengan guru di halaman Jadwal.</Note>}
        {data && data.rows.length > 0 && (
          <WarmTable head={["Guru", "Kelas", "Mapel"]}>
            {data.rows.map((r) => (
              <tr key={r.id}>
                <td style={warmCell({ fontWeight: 700 })}>{r.teacher.name}</td>
                <td style={warmCell()}>{r.class.name}</td>
                <td style={warmCell()}>{r.subject ?? "-"}</td>
              </tr>
            ))}
          </WarmTable>
        )}
        <Note>Penugasan dihitung otomatis dari slot jadwal (mapel = yang tersering per pasangan guru–kelas). Untuk mengubah, edit slot di halaman Jadwal.</Note>
      </Panel>
    </>
  );
}
