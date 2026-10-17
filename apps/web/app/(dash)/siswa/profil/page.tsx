"use client";

import { useState } from "react";
import { useFetch } from "@/app/lib/api";
import { buttonVariants } from "@/components/ui/button";
import KartuSection from "@/components/siswa/KartuSection";
import UploadPopup from "@/components/UploadPopup";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

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
        right={<a className={cn(buttonVariants({ variant: "sticker-ghost" }), "no-underline")} href="/change-password">Ganti kata sandi</a>}
      />
      <div className="grid gap-[14px]">
        <KartuSection />
        {loading && <Alert>Memuat…</Alert>}
        {error && <Alert variant="destructive">Gagal: {error}</Alert>}
        {data && (
          <Card className="max-w-[520px]">
            <div className="flex gap-[14px] items-center mb-3">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="rounded-full object-cover" src={avatar} alt="Avatar" width={64} height={64} />
              ) : (
                <div className="w-[64px] h-[64px] rounded-full bg-paper-deep grid place-items-center font-bold">
                  {data.user.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-[0px]">
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
                {msg && <Alert>{msg}</Alert>}
              </div>
            </div>
            <div className="grid gap-[10px] text-sm">
              {[
                ["Nama", data.user.name],
                ["NISN", data.user.nisn ?? "-"],
                ["Email", data.user.email ?? "-"],
                ["Kelas", data.user.studentProfile?.class?.name ?? "-"],
              ].map(([k, v]) => (
                <div className="flex gap-3 flex-wrap" key={k}>
                  <span className="min-w-[70px] text-muted shrink-0">{k}</span>
                  <strong>{v}</strong>
                </div>
              ))}
              {data.user.studentProfile?.bio && (
                <div className="flex gap-3">
                  <span className="w-[70px] text-muted">Bio</span>
                  <span>{data.user.studentProfile.bio}</span>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
