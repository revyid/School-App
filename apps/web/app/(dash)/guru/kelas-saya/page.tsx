"use client";

import { useFetch } from "@/app/lib/api";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export default function GuruHome() {
  const { data, loading, error } = useFetch<{ rows: { id: string; class: { name: string }; subject: string | null }[] }>(`/api/assignments`);
  return (
    <>
      <PageHead
        kicker="Dasbor guru"
        title="Kelas yang diampu"
        desc="Daftar kelas tempatmu mengajar semester ini."
        right={<a className={cn(buttonVariants({ variant: "sticker-ghost" }), "no-underline")} href="/change-password">Ganti kata sandi</a>}
      />
      <Card>
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
        {error && <Alert variant="destructive">Gagal: {error}</Alert>}
        {data && data.rows.length === 0 && <Alert>Belum ada penugasan. Hubungi admin.</Alert>}
        {data && data.rows.length > 0 && (
          <ul className="list-none m-0 p-0 grid gap-[10px]">
            {data.rows.map((r) => (
              <li className="flex gap-[10px] items-baseline pt-[10px] pr-[14px] pb-[10px] pl-[14px] border border-solid border-line rounded-[14px]" key={r.id}>
                <span className="display text-base">{r.class.name}</span>
                {r.subject && <span className="text-[13px] text-muted">{r.subject}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
