"use client";

// Root: daftar pengguna lintas sekolah + filter klien + toggle aktif.
import { useMemo, useState, type CSSProperties } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";

interface UserRow {
  id: string;
  name: string;
  email: string;
  nisn?: string | null;
  role: string;
  isActive?: boolean;
  active?: boolean;
  schoolId?: string | null;
  schoolName?: string | null;
  school?: { id: string; name: string } | null;
}

interface UsersResponse {
  users?: UserRow[];
  rows?: UserRow[];
  total?: number;
}

const ROLE_STYLE: Record<string, CSSProperties> = {
  SUPER_ADMIN: { background: "var(--color-blush)", color: "var(--color-terracotta-deep)", borderColor: "var(--color-terracotta)" },
  ADMIN: { background: "rgba(113, 132, 90, 0.16)", color: "var(--color-olive-deep)", borderColor: "var(--color-olive)" },
  GURU: { background: "rgba(151, 196, 219, 0.32)", color: "#25566b", borderColor: "var(--color-sky)" },
  SISWA: { background: "var(--color-mint-soft)", color: "var(--color-olive-deep)", borderColor: "var(--color-mint)" },
};

const SELECT_CLASS =
  "h-10 rounded-xl border border-input bg-cream px-3 text-sm text-ink outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

export default function PantauUsersPage() {
  const { data, loading, error, reload } = useFetch<UsersResponse>("/api/root/users?perPage=200");
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [school, setSchool] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const rows = data?.users ?? data?.rows ?? [];
  const schoolName = (u: UserRow) => u.school?.name ?? u.schoolName ?? "–";
  const schoolKey = (u: UserRow) => u.schoolId ?? u.school?.id ?? schoolName(u);

  const schoolOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of rows) m.set(schoolKey(u), schoolName(u));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((u) => {
      if (role && u.role !== role) return false;
      if (school && schoolKey(u) !== school) return false;
      if (!needle) return true;
      return [u.name, u.email, u.nisn ?? ""].some((v) => v.toLowerCase().includes(needle));
    });
  }, [rows, q, role, school]);

  async function toggleActive(u: UserRow) {
    setPending(u.id);
    setMsg("");
    const res = await api(`/api/root/users/${u.id}/active`, { method: "POST" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error || `Gagal mengubah status (${res.status})`);
    } else {
      await reload();
    }
    setPending(null);
  }

  return (
    <>
      <PageHead
        kicker="Pengguna"
        title="Pengguna platform"
        desc="Semua akun dari seluruh sekolah. Filter cepat di sisi klien."
        right={
          <Button variant="sticker-ghost" disabled title="Ekspor CSV belum tersedia">
            Ekspor CSV
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2.5">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama, email, NISN…"
            aria-label="Cari pengguna"
            className="max-w-[280px]"
          />
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter peran" className={SELECT_CLASS}>
            <option value="">Semua peran</option>
            <option value="SUPER_ADMIN">Super admin</option>
            <option value="ADMIN">Admin</option>
            <option value="GURU">Guru</option>
            <option value="SISWA">Siswa</option>
          </select>
          <select value={school} onChange={(e) => setSchool(e.target.value)} aria-label="Filter sekolah" className={SELECT_CLASS}>
            <option value="">Semua sekolah</option>
            {schoolOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <span className="font-meta text-[10px] text-muted">{filtered.length} dari {rows.length}</span>
        </div>

        {msg && <Alert variant="destructive">{msg}</Alert>}
        {error && <Alert variant="destructive">{error}</Alert>}
        {loading && !data && <Alert>Memuat pengguna…</Alert>}
        {!loading && !error && rows.length === 0 && <Alert>Belum ada pengguna.</Alert>}
        {rows.length > 0 && filtered.length === 0 && <Alert>Tidak ada pengguna yang cocok dengan filter.</Alert>}

        {filtered.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-line">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow className="border-line bg-paper-deep hover:bg-paper-deep">
                  {["Sekolah", "Nama", "Email", "NISN", "Peran", "Aktif"].map((head) => (
                    <TableHead key={head} className="whitespace-nowrap text-[10px] tracking-[.09em]">{head}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => {
                  const active = u.isActive ?? u.active ?? true;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="whitespace-nowrap text-[13px]">{schoolName(u)}</TableCell>
                      <TableCell className="font-bold">{u.name}</TableCell>
                      <TableCell className="text-[13px]">{u.email}</TableCell>
                      <TableCell className="font-meta text-xs">{u.nisn ?? "–"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" style={ROLE_STYLE[u.role] ?? undefined}>{u.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant={active ? "sticker-ghost" : "outline"}
                          disabled={pending === u.id}
                          aria-pressed={active}
                          onClick={() => toggleActive(u)}
                        >
                          {pending === u.id ? "…" : active ? "Aktif" : "Nonaktif"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </>
  );
}
