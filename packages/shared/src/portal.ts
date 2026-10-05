import { z } from "zod";

// ---------- BookProvider (pluggable; default Open Library, tanpa scraping) ----------

export interface Book {
  title: string;
  authors: string[];
  year?: number;
  coverUrl?: string;
  infoUrl?: string;
}

export interface BookProvider {
  search(q: string, limit?: number): Promise<Book[]>;
}

export class OpenLibraryProvider implements BookProvider {
  async search(q: string, limit = 10): Promise<Book[]> {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=${Math.min(20, Math.max(1, limit))}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`openlibrary ${res.status}`);
    const data = (await res.json()) as {
      docs?: { title?: string; author_name?: string[]; first_publish_year?: number; cover_i?: number; key?: string }[];
    };
    return (data.docs ?? []).slice(0, limit).map((d) => ({
      title: d.title ?? "(tanpa judul)",
      authors: d.author_name ?? [],
      year: d.first_publish_year,
      coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : undefined,
      infoUrl: d.key ? `https://openlibrary.org${d.key}` : undefined,
    }));
  }
}

// ---------- Skema portal ----------

export const announcementInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
  target: z.string().trim().max(64).default("ALL"),
  publishAt: z.string().datetime({ offset: true }).optional().nullable(),
});

export function announcementVisible(
  target: string,
  viewer: { role: string; classId: string | null },
): boolean {
  if (target === "ALL") return true;
  if (target === "GURU") return viewer.role === "GURU" || viewer.role === "ADMIN";
  if (target === "SISWA") return viewer.role === "SISWA" || viewer.role === "ADMIN";
  if (target.startsWith("kelas:")) {
    return viewer.classId != null && target === `kelas:${viewer.classId}`;
  }
  return false;
}

export const collabInputSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  anonymous: z.boolean().default(false),
  recipients: z.array(z.string().min(1).max(64)).min(1).max(20),
  body: z.string().trim().min(1).max(10000),
});

export const collabReplySchema = z.object({
  body: z.string().trim().min(1).max(10000),
});

export function collabSenderShown(
  t: { anonymous: boolean; senderId: string },
  viewer: { role: string; userId: string; revealed: boolean },
): boolean {
  if (!t.anonymous) return true;
  if (t.senderId === viewer.userId) return true; // pengirim selalu tahu miliknya
  if (viewer.role === "ADMIN" && viewer.revealed) return true; // admin pasca-reveal audit
  return false;
}
