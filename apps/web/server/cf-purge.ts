// Purge cache edge Cloudflare setelah data publik berubah.
//
// Tanpa ini, halaman yang sudah di-cache edge (Cache Rules) serving versi lama
// sampai TTL habis. Memakai token dengan izin "Cache Purge" (env CF_API_TOKEN).
// Kalau env tidak di-set, fungsi ini no-op — purge adalahSACARA, bukan syarat.

const CF_API = "https://api.cloudflare.com/client/v4/zones";

export async function purgeEdge(paths: string[]): Promise<void> {
  const token = process.env.CF_API_TOKEN;
  const zone = process.env.CF_ZONE_ID;
  if (!token || !zone || paths.length === 0) return;
  const apex = process.env.APEX_DOMAIN ?? "lacakedu.web.id";
  const files = paths.map((p) => (p.startsWith("http") ? p : `https://${apex}${p}`));
  try {
    await fetch(`${CF_API}/${zone}/purge_cache`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ files }),
      cache: "no-store",
    });
  } catch {
    // Purge gagal tidak boleh menggagalkan update setting.
  }
}
