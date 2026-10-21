"use client";

// Daftar sekolah publik di landing platform. Sumber: /api/public/schools
// (direktori: id/slug/nama + URL, tanpa angka internal per sekolah).
import { useFetch } from "@/app/lib/api";
import Reveal from "@/components/Reveal";

type SchoolItem = {
  id: string;
  slug: string;
  name: string;
  url: string;
};

type SchoolsResponse = {
  schools: SchoolItem[];
  total: number;
};

export default function SchoolsClient() {
  const { data, loading } = useFetch<SchoolsResponse>("/api/public/schools");
  const schools = data?.schools ?? [];

  if (loading && !data) {
    return <p style={{ color: "#575752", fontSize: 14 }}>Memuat daftar sekolah…</p>;
  }

  if (schools.length === 0) {
    return (
      <div className="card" style={{ padding: 28 }}>
        <p style={{ color: "#575752", margin: 0, fontSize: 14 }}>Belum ada sekolah terdaftar.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
      {schools.map((s, i) => (
        <Reveal key={s.id} delay={i * 40}>
          <a
            href={s.url}
            className="card card-lift"
            style={{ display: "block", padding: 24, textDecoration: "none", color: "inherit", height: "100%" }}
          >
            <h3 className="display" style={{ fontSize: 17, marginBottom: 6 }}>{s.name}</h3>
            <p style={{ fontFamily: "var(--font-meta)", fontSize: 11, color: "#6d6d66", margin: 0, textTransform: "uppercase", letterSpacing: ".06em" }}>
              {new URL(s.url).host}
            </p>
          </a>
        </Reveal>
      ))}
    </div>
  );
}
