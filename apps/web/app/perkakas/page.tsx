import { schoolSlugFromHost } from "@sms/shared/school";
import { db } from "@sms/db/client";
import { headers } from "next/headers";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";

export default async function ToolsHubPage() {
  const h = await headers();
  const host = h.get("host") ?? "";
  const apex = process.env.APEX_DOMAIN ?? "domainmu.id";
  const slug = schoolSlugFromHost(host, apex);

  let schoolName = "Portal Sekolah";
  if (slug) {
    const s = await db.school.findFirst({ where: { slug }, select: { name: true } });
    if (s?.name) schoolName = s.name;
  }

  return (
    <div style={{ background: "#f7f4ec", minHeight: "100vh", color: "#171716" }}>
      <PublicHeader schoolName={schoolName} />

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "clamp(32px, 5vw, 64px) clamp(20px, 5vw, 40px)" }}>
        <p className="kicker" style={{ color: "#e85e43" }}>Perkakas gratis, tanpa login</p>
        <h1 className="display" style={{ fontSize: "clamp(32px, 5vw, 56px)", margin: "8px 0 16px" }}>
          Tools Digital Sekolah & <span style={{ color: "#e85e43" }}>Pembelajaran.</span>
        </h1>
        <p style={{ color: "#74746d", maxWidth: 640, fontSize: 16, lineHeight: 1.6, margin: "0 0 36px" }}>
          Kumpulan alat bantu interaktif yang dapat digunakan oleh siapapun tanpa perlu masuk ke akun dasbor.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 24 }}>
          {/* TOOL 1: Pembuat Peta Digital */}
          <Link
            href="/perkakas/peta"
            className="card"
            style={{
              display: "flex",
              flexDirection: "column",
              padding: 28,
              borderRadius: 24,
              textDecoration: "none",
              color: "inherit",
              background: "#fffdf8",
              border: "2px solid #171716",
              boxShadow: "6px 8px 0 #171716",
              transition: "transform 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span className="kicker">Peta</span>
              <span
                style={{
                  background: "#e85e43",
                  color: "#fffdf8",
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "4px 10px",
                  borderRadius: 999,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Fitur Utama
              </span>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
              Pembuat Peta Digital & Animasi Rute
            </h2>
            <p style={{ color: "#74746d", fontSize: 13.5, lineHeight: 1.55, margin: "0 0 20px", flex: 1 }}>
              Buat peta interaktif dengan rute jalan darat/jalur air, kustomisasi ikon kendaraan per titik (mobil, perahu, pesawat, sepeda), kontrol animasi kamera (kamera ikuti kendaraan / pas di layar), serta ekspor video MP4/WebM.
            </p>
            <span style={{ fontWeight: 800, color: "#e85e43", fontSize: 14 }}>
              Buka Pembuat Peta →
            </span>
          </Link>

          {/* MATERI TERPISAH: katalog buku pindah ke /buku */}
          <Link
            href="/buku"
            className="card"
            style={{
              display: "flex",
              flexDirection: "column",
              padding: 28,
              borderRadius: 24,
              textDecoration: "none",
              color: "inherit",
              background: "#fffdf8",
              border: "1px solid rgba(23,23,22,.15)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span className="kicker">Materi terpisah</span>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
              Katalog Buku Digital
            </h2>
            <p style={{ color: "#74746d", fontSize: 13.5, lineHeight: 1.55, margin: "0 0 20px", flex: 1 }}>
              Koleksi bacaan pindah ke halaman tersendiri di /buku, tetap gratis tanpa login.
            </p>
            <span style={{ fontWeight: 700, color: "#171716", fontSize: 14 }}>
              Buka /buku →
            </span>
          </Link>
        </div>
      </main>
    </div>
  );
}