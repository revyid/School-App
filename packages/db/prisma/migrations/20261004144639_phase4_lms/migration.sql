-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('UPLOAD', 'DIAGNOSTIC', 'REGULAR');

-- CreateEnum
CREATE TYPE "MaterialKind" AS ENUM ('TEXT', 'FILE', 'IMAGE');

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT,
    "authorId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "instruction" TEXT NOT NULL,
    "type" "TaskType" NOT NULL DEFAULT 'REGULAR',
    "deadline" TIMESTAMP(3),
    "publishAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "allowLate" BOOLEAN NOT NULL DEFAULT false,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskMaterial" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "kind" "MaterialKind" NOT NULL DEFAULT 'TEXT',
    "text" TEXT,
    "fileName" VARCHAR(255),
    "mime" VARCHAR(128),
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "text" TEXT,
    "link" VARCHAR(2048),
    "fileName" VARCHAR(255),
    "mime" VARCHAR(128),
    "size" INTEGER,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER,
    "feedback" VARCHAR(2000),
    "gradedById" TEXT,
    "gradedAt" TIMESTAMP(3),

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_schoolId_classId_publishAt_idx" ON "Task"("schoolId", "classId", "publishAt");

-- CreateIndex
CREATE INDEX "Task_schoolId_authorId_idx" ON "Task"("schoolId", "authorId");

-- CreateIndex
CREATE INDEX "TaskMaterial_schoolId_taskId_idx" ON "TaskMaterial"("schoolId", "taskId");

-- CreateIndex
CREATE INDEX "Submission_schoolId_taskId_idx" ON "Submission"("schoolId", "taskId");

-- CreateIndex
CREATE INDEX "Submission_schoolId_studentId_idx" ON "Submission"("schoolId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_taskId_studentId_key" ON "Submission"("taskId", "studentId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskMaterial" ADD CONSTRAINT "TaskMaterial_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskMaterial" ADD CONSTRAINT "TaskMaterial_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
