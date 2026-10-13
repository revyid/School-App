-- Hapus TeacherClass: penugasan guru-kelas dibaca LIVE dari TimetableSlot (shared data).
-- Rollback: tabel dibuat ulang kosong dari skema lama (data manual tidak dipulihkan).
DROP POLICY IF EXISTS tenant_isolation ON "TeacherClass";
REVOKE ALL ON "TeacherClass" FROM app_user;
DROP TABLE IF EXISTS "TeacherClass";
