"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import GuruManager from "@/components/admin/GuruManager";
import SiswaManager from "@/components/admin/SiswaManager";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function PenggunaInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState(sp.get("tab") === "siswa" ? "siswa" : "guru");

  function switchTab(t: "guru" | "siswa") {
    setTab(t);
    router.replace(`/admin/pengguna?tab=${t}`, { scroll: false });
  }

  return (
    <>
      <PageHead
        kicker="Data master"
        title="Pengguna"
        desc="Kelola akun guru (termasuk wali kelas dan mapel dari jadwal) dan siswa dalam satu halaman."
      />
      <Card className="mb-4">
        <div className="flex gap-2"  role="tablist" aria-label="Jenis pengguna">
          {(["guru", "siswa"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => switchTab(t)}
              className={cn(tab === t ? "btn-sticker" : "btn-sticker btn-ghost", "min-h-[44px] capitalize")}
            >
              {t === "guru" ? "Guru" : "Siswa"}
            </button>
          ))}
        </div>
      </Card>
      {tab === "guru" ? <GuruManager /> : <SiswaManager />}
    </>
  );
}

export default function PenggunaPage() {
  return (
    <Suspense>
      <PenggunaInner />
    </Suspense>
  );
}
