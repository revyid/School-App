// /tools/peta — Pembuat Peta Digital publik (tanpa login).
// Canvas interaktif dimuat via client wrapper agar tidak kena prerender SSR.
import PetaLoader from "./PetaLoader";

export const metadata = {
  title: "Pembuat Peta Digital — Tools SMS-LMS",
  description:
    "Buat peta rute animasi: kamera ikuti kendaraan atau pas di layar, jalur darat atau air, kendaraan per lokasi, ekspor MP4/PNG.",
};

export default function PetaPage() {
  return <PetaLoader />;
}
