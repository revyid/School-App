"use client";

import { useFetch } from "@/app/lib/api";
import { PageHead, Panel, Note, Err, LinkBtn } from "@/components/DashUI";

export default function SiswaProfilPage() {
  const { data, loading, error } = useFetch<{ user: { name: string; nisn: string | null; email: string | null; studentProfile: { bio: string | null; class: { name: string } | null } | null } }>(`/api/profile`);

  return (
    <>
      <PageHead
        kicker="Akun"
        title="Profil saya"
        desc="Data dirimu tercatat di sekolah. Minta admin bila ada yang salah."
        right={<LinkBtn href="/change-password">Ganti kata sandi</LinkBtn>}
      />
      {loading && <Note>Memuat…</Note>}
      {error && <Err>Gagal: {error}</Err>}
      {data && (
        <Panel style={{ maxWidth: 520 }}>
          <div style={{ display: "grid", gap: 10, fontSize: 14 }}>
            {[
              ["Nama", data.user.name],
              ["NISN", data.user.nisn ?? "-"],
              ["Email", data.user.email ?? "-"],
              ["Kelas", data.user.studentProfile?.class?.name ?? "-"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span style={{ minWidth: 70, color: "#74746d", flexShrink: 0 }}>{k}</span>
                <strong>{v}</strong>
              </div>
            ))}
            {data.user.studentProfile?.bio && (
              <div style={{ display: "flex", gap: 12 }}>
                <span style={{ width: 70, color: "#74746d" }}>Bio</span>
                <span>{data.user.studentProfile.bio}</span>
              </div>
            )}
          </div>
        </Panel>
      )}
    </>
  );
}
