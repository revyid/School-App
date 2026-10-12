-- T1: kategori unggahan per tugas + file submission per kategori + status DRAFT/PUBLISHED
-- + kelompok v2 (ketua/creator) + timezone + N5 (href notifikasi) + A4 (SHORT) + B1 (drift fix).
-- Semua tabel baru: ENABLE + FORCE RLS + policy tenant + GRANT app_user (gaya migrasi AI/push).

-- ---------- Enum baru ----------
CREATE TYPE "TaskStatus" AS ENUM ('DRAFT', 'PUBLISHED');
CREATE TYPE "UploadAccept" AS ENUM ('PDF', 'IMAGE', 'VIDEO', 'DOC');
ALTER TYPE "MaterialKind" ADD VALUE 'VIDEO';
ALTER TYPE "QType" ADD VALUE 'SHORT';

-- ---------- TaskCategory ----------
CREATE TABLE "TaskCategory" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "instruction" TEXT,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "accept" "UploadAccept"[],
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "TaskCategory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaskCategory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TaskCategory_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TaskCategory_schoolId_taskId_position_idx" ON "TaskCategory"("schoolId", "taskId", "position");

-- ---------- SubmissionFile ----------
CREATE TABLE "SubmissionFile" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "categoryId" TEXT,
  "fileName" VARCHAR(255) NOT NULL,
  "originalName" VARCHAR(255) NOT NULL,
  "mime" VARCHAR(128) NOT NULL,
  "size" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubmissionFile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SubmissionFile_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SubmissionFile_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SubmissionFile_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TaskCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
-- Satu file per (submission, kategori); NULL kategori = file tunggal klasik.
-- Postgres: UNIQUE memperlakukan NULL berbeda — partial index menutup celah ganda.
CREATE UNIQUE INDEX "SubmissionFile_submissionId_categoryId_key" ON "SubmissionFile"("submissionId", "categoryId") WHERE "categoryId" IS NOT NULL;
CREATE UNIQUE INDEX "SubmissionFile_submissionId_null_category_key" ON "SubmissionFile"("submissionId") WHERE "categoryId" IS NULL;
CREATE INDEX "SubmissionFile_schoolId_submissionId_idx" ON "SubmissionFile"("schoolId", "submissionId");

-- ---------- Kolom Task ----------
ALTER TABLE "Task" ADD COLUMN "status" "TaskStatus" NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE "Task" ADD COLUMN "groupMin" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "Task" ADD COLUMN "groupMax" INTEGER NOT NULL DEFAULT 5;

-- ---------- Kolom TaskMaterial ----------
ALTER TABLE "TaskMaterial" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "TaskMaterial" ADD CONSTRAINT "TaskMaterial_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TaskCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "TaskMaterial_categoryId_idx" ON "TaskMaterial"("categoryId");

-- ---------- Kolom Submission (kelompok D1) ----------
ALTER TABLE "Submission" ADD COLUMN "groupId" TEXT;
ALTER TABLE "Submission" ADD COLUMN "submittedById" TEXT;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TaskGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- Unique parsial: satu pengumpulan per kelompok (tugas kelompok).
CREATE UNIQUE INDEX "Submission_taskId_groupId_key" ON "Submission"("taskId", "groupId") WHERE "groupId" IS NOT NULL;

-- ---------- TaskGroup v2 ----------
ALTER TABLE "TaskGroup" ADD COLUMN "createdById" TEXT NOT NULL DEFAULT '';
ALTER TABLE "TaskGroup" ADD COLUMN "leaderId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "TaskGroup" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ---------- SchoolSettings ----------
ALTER TABLE "SchoolSettings" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta';

-- ---------- Notification (N5: tautan tujuan + jenis) ----------
ALTER TABLE "Notification" ADD COLUMN "href" VARCHAR(300);
ALTER TABLE "Notification" ADD COLUMN "kind" TEXT;

-- ---------- A4: SHORT answers ----------
ALTER TABLE "Question" ADD COLUMN "shortAnswers" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AssessQuestion" ADD COLUMN "shortAnswers" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- ---------- Backfill: salin file lama Submission → SubmissionFile(categoryId=null) ----------
INSERT INTO "SubmissionFile" ("id", "schoolId", "submissionId", "categoryId", "fileName", "originalName", "mime", "size", "createdAt")
SELECT
  'sfw_' || md5(s."id"),
  s."schoolId",
  s."id",
  NULL,
  s."fileName",
  s."fileName",
  COALESCE(s."mime", 'application/octet-stream'),
  COALESCE(s."size", 0),
  s."submittedAt"
FROM "Submission" s
WHERE s."fileName" IS NOT NULL AND s."fileName" <> '';

-- ---------- B1: koreksi drift migrasi lama ----------
-- 1) FK schoolId → School untuk TaskGroup/TaskGroupMember (schema mendeklarasikan relasinya).
ALTER TABLE "TaskGroup" ADD CONSTRAINT "TaskGroup_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskGroupMember" ADD CONSTRAINT "TaskGroupMember_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- 2) Samakan ekspresi policy (current_setting dengan fallback true, gaya migrasi AI/push).
DROP POLICY IF EXISTS tenant_isolation ON "TaskGroup";
CREATE POLICY tenant_isolation ON "TaskGroup" FOR ALL TO app_user USING ("schoolId" = current_setting('app.school_id', true)) WITH CHECK ("schoolId" = current_setting('app.school_id', true));
DROP POLICY IF EXISTS tenant_isolation ON "TaskGroupMember";
CREATE POLICY tenant_isolation ON "TaskGroupMember" FOR ALL TO app_user USING ("schoolId" = current_setting('app.school_id', true)) WITH CHECK ("schoolId" = current_setting('app.school_id', true));

-- ---------- RLS tabel baru ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['TaskCategory', 'SubmissionFile'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON public.%I FOR ALL TO app_user USING ("schoolId" = current_setting(''app.school_id'', true)) WITH CHECK ("schoolId" = current_setting(''app.school_id'', true))', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO app_user', t);
  END LOOP;
END $$;
