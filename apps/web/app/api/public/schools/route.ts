import { NextResponse } from "next/server";
import { getPublicSchools } from "@/lib/public-cache";

// GET /api/public/schools — direktori publik untuk landing platform.
// Hanya kolom direktori (id/slug/nama); School tidak memuat data pribadi.
// Di-cache 60 detik (tag: public-schools).
export async function GET() {
  return NextResponse.json(await getPublicSchools());
}
