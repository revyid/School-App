// Nonce CSP (diset proxy.ts) hanya ditempel Next pada halaman DINAMIS.
// `await connection()` + force-dynamic memastikan tidak ada halaman yang
// ter-prerender statis tanpa nonce.
import { connection } from "next/server";
import SwRegister from "@/components/SwRegister";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "SMS-LMS",
  description: "Sistem Manajemen Sekolah + LMS",
  manifest: "/manifest.webmanifest",
  robots: { index: true, follow: true },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return (
    <html lang="id">
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
