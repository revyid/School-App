"use client";

import { useState } from "react";
import { useFetch } from "@/app/lib/api";
import { PageHead, Panel, Note, Err } from "@/components/DashUI";
import { buttonVariants } from "@/components/ui/button";
import KartuSection from "@/components/siswa/KartuSection";
import UploadPopup from "@/components/UploadPopup";

type Profile = {
  user: {
    name: string; nisn: string | null; email: string | null;
    studentProfile: { bio: string | null; avatarUrl: string | null; class: { name: string } | null } | null;
  };
};

export default function SiswaProfilPage() {
  const { data, loading, error, reload } = useFetch<Profile>(`/api/profile`);
  const [msg, setMsg] = useState<string | null>(null);

  const avatar = data?.user.studentProfile?.avatarUrl ?? null;

  return (
    <>
      <PageHead
        kicker="Akun"
        title="Profil saya"
        desc="Data dirimu tercatat di sekolah. Minta admin bila ada yang salah."
        right={<a className={buttonVariants({ variant: "sticker-ghost" })} style={{ textDecoration: "none" }} href="/change-password">Ganti kata sandi</a>}
      />
      <div style={{ display: "grid", gap: 14 }}>
        <KartuSection />
        {loading && <Note>Memuat…</Note>}
        {error && <Err>Gagal: {error}</Err>}
        {data && (
          <Panel style={{ maxWidth: 520 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 12 }}>
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="Avatar" width={64} height={64} style={{ borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#eee", display: "grid", placeItems: "center", fontWeight: 700 }}>
                  {data.user.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <UploadPopup
                  accept="image/png,image/jpeg,image/webp"
                  maxMb={2}
                  label="Ganti foto profil"
                  onUpload={async (f, onProgress) => {
                    setMsg(null);
                    onProgress(10);
                    const fd = new FormData();
                    fd.append("file", f);
                    const r = await fetch("/api/profile/avatar", { method: "POST", body: fd });
                    onProgress(90);
                    if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? "Upload gagal");
                    onProgress(100);
                    setMsg("Foto profil diperbarui.");
                    await reload();
                  }}
                />
                {msg && <Note>{msg}</Note>}
              </div>
            </div>
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
      </div>
    </>
  );
}
