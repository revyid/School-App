"use client";

// Root: daftar sekolah + hitungan dasar.
import Link from "next/link";
import { useFetch } from "@/app/lib/api";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface School {
  id: string;
  slug: string;
  name: string;
  studentCount?: number;
  teacherCount?: number;
  classCount?: number;
}

interface SchoolsResponse {
  schools?: School[];
  total?: number;
}

const n = (v: number | undefined) => (v == null ? "–" : v.toLocaleString("id-ID"));

export default function PantauSchoolsPage() {
  const { data, loading, error } = useFetch<SchoolsResponse>("/api/root/schools");
  const schools = data?.schools ?? [];

  return (
    <>
      <PageHead
        kicker="Sekolah"
        title="Sekolah terdaftar"
        desc="Daftar tenant pada platform ini."
        right={
          <Button variant="sticker-ghost" disabled title="Butuh akses DB/role — belum tersedia">
            Tambah sekolah
          </Button>
        }
      />

      {error && <Alert variant="destructive">{error}</Alert>}
      {loading && !data && <Alert>Memuat sekolah…</Alert>}
      {!loading && !error && schools.length === 0 && <Alert>Belum ada sekolah terdaftar.</Alert>}

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }}>
        {schools.map((s) => (
          <Card key={s.id} className="card-lift justify-between">
            <div>
              <h2 className="display m-0 text-[18px]">{s.name}</h2>
              <p className="mt-1 font-meta text-[10px] uppercase tracking-[.08em] text-muted">{s.slug}</p>
            </div>
            <div className="flex flex-wrap gap-4 text-[12px] text-muted">
              <span><strong className="text-ink">{n(s.studentCount)}</strong> siswa</span>
              <span><strong className="text-ink">{n(s.teacherCount)}</strong> guru</span>
              <span><strong className="text-ink">{n(s.classCount)}</strong> kelas</span>
            </div>
            <div>
              <Button variant="sticker-ghost" render={<Link href={`/pantau/schools/${s.id}`} />}>
                Atur
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
