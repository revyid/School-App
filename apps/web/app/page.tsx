// Root "/" = landing publik per sekolah (guest maupun login boleh melihat).
// User yang SUDAH login tetap bisa membaca landing; semua CTA masuk/login
// beralih ke "Buka dasbor" sesuai perannya (tanpa redirect paksa).
import PortalPage from "./(portal)/page";

export default function HomePage() {
  return <PortalPage />;
}
