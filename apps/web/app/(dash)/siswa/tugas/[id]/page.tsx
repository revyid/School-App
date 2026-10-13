import { redirect } from "next/navigation";

// FASE 2: detail tugas dibuka dari Kelasku — URL lama dialihkan ke Kelasku.
export default async function SiswaTugasDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/siswa/kelasku?tugas=${encodeURIComponent(id)}`);
}
