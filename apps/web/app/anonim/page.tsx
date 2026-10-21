import { schoolSlugFromHost } from "@lacakedu/shared/school";
import { db } from "@lacakedu/db/client";
import { runAsSchool } from "@lacakedu/db/tenant";
import { headers } from "next/headers";
import { PesanBaruDialog } from "@/components/PesanBaruDialog";
import AnonimForm from "@/components/AnonimForm";
import PublicHeader from "@/components/PublicHeader";

// Halaman publik CTA anonim — tanpa login (untuk masyarakat umum).
// "Pesan baru" dialog menampilkan daftar guru + mapel.
export default async function AnonimPage() {
  const h = await headers();
  const host = h.get("host") ?? "";
  const apex = process.env.APEX_DOMAIN ?? "domainmu.id";
  const slug = schoolSlugFromHost(host, apex);
  let schoolName = "Portal Sekolah";
  if (slug) {
    const s = await db.school.findFirst({ where: { slug }, select: { id: true, name: true } });
    if (s) {
      schoolName = s.name;
      try {
        const st = await runAsSchool(db, s.id, (tx) =>
          tx.schoolSettings.findUnique({ where: { schoolId: s.id }, select: { portalName: true } }));
        if (st?.portalName) schoolName = st.portalName;
      } catch { /* fallback ke nama sekolah */ }
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#fffdf8", color: "#171716" }}>
      <PublicHeader schoolName={schoolName} />
      <main
        style={{
          display: "grid",
          placeItems: "center",
          padding: 20,
        }}
      >
        <div style={{ maxWidth: 640, width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#575752", margin: "0 0 8px" }}>
              Pesan anonim — tanpa login
            </p>
            <h1
              className="display"
              style={{ margin: "0 0 8px", fontSize: "clamp(22px, 5vw, 28px)", lineHeight: 1.2 }}
            >
              Sampaikan Aspirasi Anda
            </h1>
            <p style={{ color: "#74746d", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              Form anonim untuk masyarakat umum — tanpa login, tanpa nama wajib.
              Pesan Anda diteruskan ke pihak sekolah.
            </p>
          </div>

          {/* Dialog "Pesan baru": guru + mapel. */}
          <PesanBaruDialog
            title="Pesan baru"
            description="Pilih guru, lalu kirim pesan. Nama Anda tetap anonim."
          />

          <AnonimForm />
          <p
            style={{
              textAlign: "center",
              fontSize: 12,
              color: "#a0a096",
              marginTop: 20,
              lineHeight: 1.6,
            }}
          >
            Maksimal 5 pesan per jam dari perangkat yang sama.
            Jangan cantumkan data pribadi sensitif.
          </p>
        </div>
      </main>
    </div>
  );
}
