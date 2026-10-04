// Nonce CSP (diset proxy.ts) hanya ditempel Next pada halaman DINAMIS.
// `await connection()` + force-dynamic memastikan tidak ada halaman yang
// ter-prerender statis tanpa nonce.
import { connection } from "next/server";
import "./globals.css";

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
