// T2: helper bersama API tugas v2 — akses, pengecekan kategori, XP & notifikasi.
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { guruClassIds } from "@/server/lms-scope";
import { notifyUser } from "@/server/notify";
import { awardExp } from "@/server/exp";

export async function canManageTask(
  schoolId: string,
  userId: string,
  role: string,
  task: { classId: string; authorId: string; targets?: { classId: string }[] },
): Promise<boolean> {
  if (role === "ADMIN") return true;
  if (role !== "GURU") return false;
  const mine = await guruClassIds(schoolId, userId);
  return mine.has(task.classId) || (task.targets?.some((x) => mine.has(x.classId)) ?? false) || task.authorId === userId;
}

// T8: EXP pengumpulan — tepat waktu / terlambat, dedupe per (tugas, siswa).
export async function awardSubmitExp(
  schoolId: string,
  taskId: string,
  studentIds: string[],
  late: boolean,
): Promise<void> {
  await Promise.all(
    studentIds.map((sid) =>
      awardExp(schoolId, sid, late ? "submitTerlambat" : "submitTepat", `task-${taskId}-${sid}`).catch(() => {}),
    ),
  );
}

// T2: notifikasi saat tugas dipublikasikan / deadline berubah.
export async function notifyTaskChange(
  schoolId: string,
  taskId: string,
  classId: string,
  kind: "published" | "deadline",
  title: string,
): Promise<void> {
  const students = await runAsSchool(db, schoolId, (tx) =>
    tx.studentProfile.findMany({ where: { classId }, select: { userId: true }, take: 500 }));
  const body = kind === "published"
    ? "Ada tugas baru untuk kelasmu. Buka untuk melihat detail dan tenggat."
    : "Tenggat tugas diubah. Buka untuk melihat detail terbaru.";
  await Promise.all(
    students.map((s: { userId: string }) =>
      notifyUser(schoolId, s.userId, title, body, {
        href: `/siswa/tugas/${taskId}`,
        kind: `task-${kind}`,
      }).catch(() => {}),
    ),
  );
}

// T2: validasi konten submit terhadap kategori tugas.
export interface CategoryRow {
  id: string;
  name: string;
  required: boolean;
  accept: string[];
}

export function validateCategoryFiles(
  cats: CategoryRow[],
  filesByCategory: Map<string, { mime: string; size: number }>,
): string | null {
  const ACCEPT_MIME: Record<string, string[]> = {
    PDF: ["application/pdf"],
    IMAGE: ["image/png", "image/jpeg", "image/webp", "image/gif"],
    VIDEO: ["video/mp4", "video/webm"],
    // DOC: semua container zip/office — docx, xlsx, pptx, zip biasa.
    DOC: [
      "application/octet-stream",
      "application/zip",
      "application/x-zip-compressed",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/msword",
      "application/vnd.ms-excel",
      "application/vnd.ms-powerpoint",
    ],
  };
  for (const c of cats) {
    const f = filesByCategory.get(c.id);
    if (c.required && !f) return `Kategori "${c.name}" wajib diisi`;
    if (f) {
      const okMime = c.accept.some((acc) => (ACCEPT_MIME[acc] ?? []).includes(f.mime));
      if (!okMime) return `Tipe file untuk "${c.name}" tidak sesuai`;
    }
  }
  return null;
}

// D1: memberikan studentId pemilik pengumpulan (kelompok → semua anggota).
export async function groupMemberIds(schoolId: string, groupId: string): Promise<string[]> {
  const rows = await runAsSchool(db, schoolId, (tx) =>
    tx.taskGroupMember.findMany({ where: { groupId }, select: { studentId: true } }));
  return rows.map((r: { studentId: string }) => r.studentId);
}

// T6/D2: status kunci kelompok — terkunci saat deadline lewat ATAU sudah ada pengumpulan.
// Guru/admin tetap boleh mengubah kapan saja (dicek di route).
export async function groupLockState(
  schoolId: string,
  taskId: string,
  deadline: Date | null,
): Promise<{ locked: boolean; reason: string | null }> {
  if (deadline && deadline.getTime() < Date.now()) {
    return { locked: true, reason: "tenggat sudah lewat" };
  }
  const hasSub = await runAsSchool(db, schoolId, (tx) =>
    tx.submission.count({ where: { taskId } }));
  if (hasSub > 0) return { locked: true, reason: "sudah ada pengumpulan" };
  return { locked: false, reason: null };
}
