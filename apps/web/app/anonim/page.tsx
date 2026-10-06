// Halaman publik CTA anonim — tanpa login (untuk masyarakat umum)
import AnonimForm from "@/components/AnonimForm";

export default function AnonimPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#fffdf8",
        color: "#171716",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div style={{ maxWidth: 640, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
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
  );
}
