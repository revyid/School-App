import type { ReactNode } from "react";
import PublicHeader from "./PublicHeader";

// Kerangka bersama halaman legal (/syarat, /privasi) supaya layout & tipografi
// tidak berbeda antar dokumen. Isi artikel memakai kelas `.legal` (globals.css).
export default function LegalShell({
  schoolName,
  kicker,
  title,
  updatedAt,
  children,
}: {
  schoolName: string;
  kicker: string;
  title: string;
  updatedAt?: Date | null;
  children: ReactNode;
}) {
  return (
    <div style={{ background: "#f7f4ec", minHeight: "100vh", color: "#171716" }}>
      <PublicHeader schoolName={schoolName} />
      <main style={{ maxWidth: 840, margin: "0 auto", padding: "48px 24px 72px" }}>
        <p className="kicker" style={{ color: "#e85e43" }}>{kicker}</p>
        <h1 className="display" style={{ fontSize: 36, margin: "8px 0 24px" }}>{title}</h1>
        <article className="card legal" style={{ padding: 32 }}>
          {updatedAt ? (
            <p style={{ fontSize: 13, color: "#6d6d66", marginBottom: 8 }}>
              Terakhir diperbarui:{" "}
              {new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(updatedAt)}
            </p>
          ) : null}
          {children}
        </article>
      </main>
    </div>
  );
}
