-- Task kategori KUIS/PROYEK/LATIHAN + materi utama/contoh + grup + video soal asesmen.
ALTER TYPE "TaskType" ADD VALUE 'KUIS';
ALTER TYPE "TaskType" ADD VALUE 'PROYEK';
ALTER TYPE "TaskType" ADD VALUE 'LATIHAN';
ALTER TABLE "TaskMaterial" ADD COLUMN "isMain" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TaskMaterial" ADD COLUMN "isExample" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Question" ADD COLUMN "videoName" VARCHAR(255);
ALTER TABLE "AssessQuestion" ADD COLUMN "videoName" VARCHAR(255);
CREATE TABLE "TaskGroup" (
  id TEXT PRIMARY KEY,
  "schoolId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL REFERENCES "Task"(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  UNIQUE ("taskId", name)
);
CREATE TABLE "TaskGroupMember" (
  id TEXT PRIMARY KEY,
  "schoolId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL REFERENCES "TaskGroup"(id) ON DELETE CASCADE,
  "taskId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  UNIQUE ("taskId", "studentId")
);
CREATE INDEX "TaskGroup_school_task_idx" ON "TaskGroup"("schoolId","taskId");
CREATE INDEX "TaskGroupMember_school_group_idx" ON "TaskGroupMember"("schoolId","groupId");
ALTER TABLE "TaskGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskGroup" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "TaskGroup" USING ("schoolId" = current_setting('app.school_id')::text) WITH CHECK ("schoolId" = current_setting('app.school_id')::text);
ALTER TABLE "TaskGroupMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskGroupMember" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "TaskGroupMember" USING ("schoolId" = current_setting('app.school_id')::text) WITH CHECK ("schoolId" = current_setting('app.school_id')::text);
GRANT SELECT, INSERT, UPDATE, DELETE ON "TaskGroup" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "TaskGroupMember" TO app_user;
