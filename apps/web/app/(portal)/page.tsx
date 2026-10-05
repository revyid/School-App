"use client";

import dynamic from "next/dynamic";
import { useFetch } from "@/app/lib/api";

const Map = dynamic(() => import("./Map"), { ssr: false });
const BookSearch = dynamic(() => import("./BookSearch"), { ssr: false });

// Portal publik per sekolah (tanpa login): nama, peta Leaflet, katalog buku,
// CTA Ruang GTK/Murid, pengumuman umum. Data non-sensitif saja.
export default function PortalPage() {
  const info = useFetch<{
    school: { name: string; lat: number | null; lng: number | null };
    portalName: string;
    ctaGtkUrl: string | null;
    ctaMuridUrl: string | null;
    announcements: { id: string; title: string; body: string; publishAt: string }[];
  }>("/api/portal/info");

  return (
    <main>
      <h1>{info.data?.portalName ?? "Portal Sekolah"}</h1>
      {info.data && (
        <>
          {info.data.school.lat != null && info.data.school.lng != null && (
            <Map lat={info.data.school.lat} lng={info.data.school.lng} />
          )}
          <div>
            {info.data.ctaGtkUrl && (
              <a href={info.data.ctaGtkUrl} target="_blank" rel="noreferrer">Ruang GTK</a>
            )}{" "}
            {info.data.ctaMuridUrl && (
              <a href={info.data.ctaMuridUrl} target="_blank" rel="noreferrer">Ruang Murid</a>
            )}
          </div>
          <h2>Pengumuman</h2>
          <ul>
            {info.data.announcements.map((p) => (
              <li key={p.id}>
                <strong>{p.title}</strong> ({p.publishAt.slice(0, 10)})
                <p>{p.body}</p>
              </li>
            ))}
          </ul>
          <BookSearch />
          <p><a href="/login">Masuk dasbor</a></p>
        </>
      )}
    </main>
  );
}
