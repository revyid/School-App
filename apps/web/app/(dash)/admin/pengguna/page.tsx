"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PageHead, Panel } from "@/components/DashUI";
import GuruManager from "@/components/admin/GuruManager";
import SiswaManager from "@/components/admin/SiswaManager";

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
      <Panel style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8 }} role="tablist" aria-label="Jenis pengguna">
          {(["guru", "siswa"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => switchTab(t)}
              className={tab === t ? "btn-sticker" : "btn-sticker btn-ghost"}
              style={{ minHeight: 44, textTransform: "capitalize" }}
            >
              {t === "guru" ? "Guru" : "Siswa"}
            </button>
          ))}
        </div>
      </Panel>
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
