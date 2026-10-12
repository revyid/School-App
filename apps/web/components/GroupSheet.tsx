"use client";

// T6: GroupSheet — komponen tunggal kelola kelompok (mode teacher | student).
// Menggunakan shadcn Sheet (Base UI): side="right" desktop, "bottom" ≤640px
// (sudah ditangani varian CSS di ui/sheet), focus-trap + Esc otomatis.
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectTrigger, SelectValue, SelectPositioner, SelectPopup, SelectItem,
} from "@/components/ui/select";
import { XIcon, UserPlusIcon, UserMinusIcon, Trash2Icon, LogOutIcon } from "lucide-react";

interface Member { id: string; name: string }
interface GroupFull {
  id: string; name: string; leaderId: string;
  members: { studentId: string; student: { id: string; name: string; nisn: string | null } }[];
}
interface GroupsData {
  rules: { min: number; max: number; locked: boolean; reason: string | null };
  rows?: GroupFull[];
  ungrouped?: { id: string; name: string; nisn: string | null; groupId: string | null }[];
  groups?: { id: string; name: string; members: string[]; size: number; full: boolean; isMine: boolean }[];
  classmates?: { id: string; name: string; groupId: null }[];
}

export default function GroupSheet({
  taskId,
  mode,
  open,
  onOpenChange,
  onChanged,
}: {
  taskId: string;
  mode: "teacher" | "student";
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onChanged?: () => void;
}) {
  const data = useFetch<GroupsData>(open ? `/api/tasks/${taskId}/groups` : null);
  const [name, setName] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Guru: siswa yang mau ditambahkan per grup.
  const [addTo, setAddTo] = useState<string>("");

  const rules = data.data?.rules;
  const isStudent = mode === "student";
  const myGroups = isStudent ? (data.data?.groups ?? []) : (data.data?.rows ?? []);
  const candidates = isStudent ? (data.data?.classmates ?? []) : (data.data?.ungrouped ?? []);

  async function createGroup() {
    setBusy(true); setMsg(null);
    const res = await api(`/api/tasks/${taskId}/groups`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(isStudent ? { name: name || undefined, memberIds } : { name }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(d.error || `Gagal (${res.status})`); return; }
    setName(""); setMemberIds([]);
    setMsg("Kelompok dibuat.");
    data.reload(); onChanged?.();
  }

  async function patchGroup(gid: string, payload: Record<string, unknown>) {
    setBusy(true); setMsg(null);
    const res = await api(`/api/tasks/${taskId}/groups/${gid}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(d.error || `Gagal (${res.status})`); return false; }
    data.reload(); onChanged?.();
    return true;
  }

  async function deleteGroup(gid: string) {
    setBusy(true); setMsg(null);
    const res = await api(`/api/tasks/${taskId}/groups/${gid}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(d.error || `Gagal (${res.status})`); return; }
    setMsg("Kelompok dihapus.");
    data.reload(); onChanged?.();
  }

  async function leaveGroup(gid: string) {
    setBusy(true); setMsg(null);
    const res = await api(`/api/tasks/${taskId}/groups/${gid}/leave`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(d.error || `Gagal (${res.status})`); return; }
    setMsg("Kamu keluar dari kelompok.");
    data.reload(); onChanged?.();
  }

  const locked = rules?.locked;
  const lockReason = rules?.reason;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="p-0">
        <SheetHeader>
          <SheetTitle>Atur kelompok</SheetTitle>
          <SheetDescription>
            {rules ? `${rules.min}–${rules.max} anggota${locked ? ` · terkunci: ${lockReason}` : ""}` : "Memuat aturan…"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 pb-6">
          {/* Buat kelompok */}
          {!locked && (
            <section className="rounded-2xl border border-line bg-paper/60 p-4">
              <h3 className="mb-3 text-sm font-extrabold">{isStudent ? "Buat kelompok baru" : "Buat kelompok kosong"}</h3>
              <div className="grid gap-3">
                <Label htmlFor="group-name">Nama kelompok {isStudent && "(opsional)"}</Label>
                <Input id="group-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder={isStudent ? "Nama kelompok (opsional)" : "Nama kelompok"} />
                {isStudent && (
                  <div>
                    <Label>Tambah teman sekelas (belum berkelompok)</Label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {candidates.length === 0 && <p className="text-xs text-muted-foreground">Semua teman sekelas sudah berkelompok.</p>}
                      {candidates.map((c) => {
                        const picked = memberIds.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            disabled={locked || memberIds.length + 1 >= (rules?.max ?? 5)}
                            onClick={() => setMemberIds((prev) => (picked ? prev.filter((x) => x !== c.id) : [...prev, c.id]))}
                            className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${picked ? "border-olive-deep bg-olive/15 text-olive-deep" : "border-line bg-cream text-ink hover:bg-paper"}`}
                            aria-pressed={picked}
                          >
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Terpilih: {memberIds.length}/{(rules?.max ?? 5) - 1} (kamu otomatis jadi anggota + ketua).
                    </p>
                  </div>
                )}
                <Button onClick={createGroup} disabled={busy || (!isStudent && !name.trim())}>
                  {isStudent ? `Buat kelompok (${memberIds.length + 1} anggota)` : "Buat kelompok"}
                </Button>
              </div>
            </section>
          )}

          {/* Daftar kelompok */}
          <section className="space-y-3">
            <h3 className="text-sm font-extrabold">{isStudent ? "Kelompok di kelasmu" : "Semua kelompok"}</h3>
            {data.loading && !data.data && (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" /> <Skeleton className="h-16 w-full" />
              </div>
            )}
            {data.data && myGroups.length === 0 && !isStudent && (
              <p className="text-sm text-muted-foreground">Belum ada kelompok.</p>
            )}
            {isStudent && data.data && (data.data.groups ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Belum ada kelompok yang terbentuk. Buat yang pertama!</p>
            )}
            {!isStudent && (data.data?.rows ?? []).map((g) => (
                  <div key={g.id} className="rounded-2xl border border-line bg-cream p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-extrabold">{g.name}</p>
                      <Badge variant={g.members.length >= (rules?.min ?? 2) ? "success" : "warning"}>
                        {g.members.length}/{rules?.max ?? 5}
                      </Badge>
                    </div>
                    <ul className="mb-3 flex flex-wrap gap-1.5">
                      {g.members.map((m) => (
                        <li key={m.studentId} className="flex items-center gap-1 rounded-full bg-paper px-2.5 py-1 text-xs font-medium">
                          {m.student.name}
                          {!locked && (
                            <button
                              type="button"
                              className="cursor-pointer text-muted-strong hover:text-destructive"
                              aria-label={`Keluarkan ${m.student.name}`}
                              onClick={() => patchGroup(g.id, { removeMemberIds: [m.studentId] })}
                              disabled={busy || m.studentId === g.leaderId}
                            >
                              <XIcon className="size-3" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                    {!locked && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Select value={addTo === g.id ? "__pick" : undefined} onValueChange={(v) => { if (v && v !== "__pick") void patchGroup(g.id, { addMemberIds: [v] }); }}>
                          <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Tambah anggota…" /></SelectTrigger>
                          <SelectPositioner>
                            <SelectPopup>
                              {(data.data?.ungrouped ?? []).map((u) => (
                                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                              ))}
                              {(data.data?.ungrouped?.length ?? 0) === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">Tidak ada siswa yang belum berkelompok.</p>}
                            </SelectPopup>
                          </SelectPositioner>
                        </Select>
                        <Button variant="outline" size="sm" onClick={() => deleteGroup(g.id)} disabled={busy}>
                          <Trash2Icon className="size-3.5" /> Hapus
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
            {/* mode siswa: kartu kelompok sendiri */}
            {isStudent && (data.data?.groups ?? []).filter((g) => g.isMine).map((g) => (
              <div key={g.id} className="rounded-2xl border border-line bg-cream p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-extrabold">{g.name}</p>
                  <Badge variant={g.size >= (rules?.min ?? 2) ? "success" : "warning"}>{g.size}/{rules?.max ?? 5}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Anggota terdaftar: {g.size}. {g.size < (rules?.min ?? 2) ? `Butuh minimal ${rules?.min ?? 2} anggota.` : "Kuota sesuai aturan guru."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!locked && (
                    <>
                      <Select onValueChange={(v) => { if (v) void patchGroup(g.id, { addMemberIds: [v] }); }}>
                        <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Tambah anggota…" /></SelectTrigger>
                        <SelectPositioner>
                          <SelectPopup>
                            {(data.data?.classmates ?? []).map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                            {(data.data?.classmates?.length ?? 0) === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">Semua teman sudah berkelompok.</p>}
                          </SelectPopup>
                        </SelectPositioner>
                      </Select>
                      <Button variant="outline" size="sm" onClick={() => leaveGroup(g.id)} disabled={busy}>
                        <LogOutIcon className="size-3.5" /> Keluar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteGroup(g.id)} disabled={busy}>
                        <Trash2Icon className="size-3.5" /> Hapus kelompok
                      </Button>
                    </>
                  )}
                  {locked && <p className="text-xs font-medium text-muted-foreground">Terkunci: {lockReason}. Guru masih bisa mengubah.</p>}
                </div>
              </div>
            ))}
            {/* Guru: indikator belum berkelompok */}
            {!isStudent && (
              <p className="text-xs text-muted-foreground">
                Belum berkelompok: {(data.data?.ungrouped?.length ?? 0)} siswa.
              </p>
            )}
          </section>

          {msg && <p className="text-sm font-bold text-olive-deep">{msg}</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
