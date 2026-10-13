-- FASE 3 guru: tugas/asesmen SHARED antar kelas (induk + join per-kelas).
-- Kolom lama (Task.classId/deadline/publishAt/allowLate/status,
-- Assessment.classId/deadline/publishAt) TETAP — dipakai sebagai fallback
-- kelas utama. Backfill idempoten: satu target per baris lama.

-- ---------- TaskTarget ----------
CREATE TABLE "TaskTarget" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "status" "TaskStatus" NOT NULL DEFAULT 'PUBLISHED',
  "deadline" TIMESTAMP(3),
  "publishAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "allowLate" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaskTarget_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaskTarget_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TaskTarget_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TaskTarget_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TaskTarget_taskId_classId_key" ON "TaskTarget"("taskId", "classId");
CREATE INDEX "TaskTarget_schoolId_classId_publishAt_idx" ON "TaskTarget"("schoolId", "classId", "publishAt");
CREATE INDEX "TaskTarget_schoolId_taskId_idx" ON "TaskTarget"("schoolId", "taskId");

-- ---------- AssessmentTarget ----------
CREATE TABLE "AssessmentTarget" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "deadline" TIMESTAMP(3),
  "publishAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssessmentTarget_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssessmentTarget_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AssessmentTarget_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AssessmentTarget_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AssessmentTarget_assessmentId_classId_key" ON "AssessmentTarget"("assessmentId", "classId");
CREATE INDEX "AssessmentTarget_schoolId_classId_publishAt_idx" ON "AssessmentTarget"("schoolId", "classId", "publishAt");
CREATE INDEX "AssessmentTarget_schoolId_assessmentId_idx" ON "AssessmentTarget"("schoolId", "assessmentId");

-- ---------- RLS + GRANT (gaya migrasi AI/push) ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['TaskTarget','AssessmentTarget'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING ("schoolId" = current_setting(%L)) WITH CHECK ("schoolId" = current_setting(%L))', t, 'app.school_id', 'app.school_id');
  END LOOP;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON "TaskTarget" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "AssessmentTarget" TO app_user;

-- ---------- Backfill idempoten dari kolom lama ----------
INSERT INTO "TaskTarget" ("id", "schoolId", "taskId", "classId", "status", "deadline", "publishAt", "allowLate", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "schoolId", "id", "classId", "status", "deadline", "publishAt", "allowLate", NOW(), NOW()
FROM "Task"
ON CONFLICT ("taskId", "classId") DO NOTHING;

INSERT INTO "AssessmentTarget" ("id", "schoolId", "assessmentId", "classId", "deadline", "publishAt", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "schoolId", "id", "classId", "deadline", "publishAt", NOW(), NOW()
FROM "Assessment"
ON CONFLICT ("assessmentId", "classId") DO NOTHING;
