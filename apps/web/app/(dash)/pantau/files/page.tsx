"use client";

// Root: file storage lintas sekolah, dikelompokkan per sekolah.
import { useMemo } from "react";
import { File as FileIcon, FileSpreadsheet, FileText, Image as ImageIcon } from "lucide-react";
import { useFetch } from "@/app/lib/api";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";

interface FileRow {
  id?: string;
  schoolId?: string | null;
  schoolName?: string | null;
  originalName: string;
  size?: number;
  bytes?: number;
  mime?: string | null;
  mimeType?: string | null;
  uploadedAt?: string;
  createdAt?: string;
}

interface FilesResponse {
  files?: FileRow[];
  rows?: FileRow[];
}

interface School {
  id: string;
  name: string;
}

interface SchoolsResponse {
  schools?: School[];
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "–";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function MimeIcon({ mime }: { mime: string }) {
  const cls = "size-4 shrink-0";
  if (mime.startsWith("image/")) return <ImageIcon className={cls} aria-hidden="true" />;
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv")) return <FileSpreadsheet className={cls} aria-hidden="true" />;
  if (mime.startsWith("text/") || mime.includes("pdf") || mime.includes("word")) return <FileText className={cls} aria-hidden="true" />;
  return <FileIcon className={cls} aria-hidden="true" />;
}

export default function PantauFilesPage() {
  const files = useFetch<FilesResponse>("/api/root/files");
  const schools = useFetch<SchoolsResponse>("/api/root/schools");
  const rows = files.data?.files ?? files.data?.rows ?? [];

  const groups = useMemo(() => {
    const names = new Map((schools.data?.schools ?? []).map((s) => [s.id, s.name]));
    const map = new Map<string, { name: string; files: FileRow[] }>();
    for (const f of rows) {
      const key = f.schoolId ?? "lain";
      const name = f.schoolName ?? names.get(key) ?? (key === "lain" ? "Tanpa sekolah" : key);
      const g = map.get(key) ?? { name, files: [] };
      g.files.push(f);
      map.set(key, g);
    }
    return [...map.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [rows, schools.data]);

  return (
    <>
      <PageHead
        kicker="Berkas"
        title="File platform"
        desc="Semua unggahan dari seluruh sekolah, dikelompokkan per sekolah."
      />

      {files.error && <Alert variant="destructive">{files.error}</Alert>}
      {files.loading && !files.data && <Alert>Memuat file…</Alert>}
      {!files.loading && !files.error && rows.length === 0 && <Alert>Belum ada file.</Alert>}

      {groups.map(([schoolId, g]) => (
        <Card key={schoolId} className="mb-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="display m-0 text-[18px]">{g.name}</h2>
            <span className="font-meta text-[10px] text-muted">{g.files.length} file</span>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-line">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow className="border-line bg-paper-deep hover:bg-paper-deep">
                  {["File", "Ukuran", "Tipe", "Diunggah", "Unduh"].map((head) => (
                    <TableHead key={head} className="whitespace-nowrap text-[10px] tracking-[.09em]">{head}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.files.map((f, i) => {
                  const mime = f.mime ?? f.mimeType ?? "";
                  const at = f.uploadedAt ?? f.createdAt;
                  return (
                    <TableRow key={f.id ?? `${f.originalName}-${i}`}>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <MimeIcon mime={mime} />
                          <span className="font-bold">{f.originalName}</span>
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-meta text-xs">{formatBytes(f.size ?? f.bytes ?? 0)}</TableCell>
                      <TableCell className="text-[12px] text-muted">{mime || "–"}</TableCell>
                      <TableCell className="whitespace-nowrap font-meta text-xs">{at ? at.slice(0, 16).replace("T", " ") : "–"}</TableCell>
                      <TableCell>
                        <a
                          href="#"
                          onClick={(e) => e.preventDefault()}
                          title="Unduhan belum tersedia"
                          className="font-bold"
                          style={{ color: "var(--color-terracotta-deep)" }}
                        >
                          Unduh
                        </a>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      ))}
    </>
  );
}
