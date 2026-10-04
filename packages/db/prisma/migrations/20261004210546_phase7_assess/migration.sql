-- CreateEnum
CREATE TYPE "QType" AS ENUM ('MCQ', 'SORTING');

-- CreateEnum
CREATE TYPE "AssessKind" AS ENUM ('DIAGNOSTIC', 'REGULAR');

-- AlterTable
ALTER TABLE "SchoolSettings" ADD COLUMN     "expRules" JSONB;

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT,
    "authorId" TEXT NOT NULL,
    "kind" "AssessKind" NOT NULL DEFAULT 'REGULAR',
    "title" VARCHAR(200) NOT NULL,
    "instruction" TEXT,
    "durationMin" INTEGER,
    "publishAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline" TIMESTAMP(3),
    "shuffleQ" BOOLEAN NOT NULL DEFAULT true,
    "shuffleOpt" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "subjectId" TEXT,
    "authorId" TEXT NOT NULL,
    "type" "QType" NOT NULL DEFAULT 'MCQ',
    "stem" TEXT NOT NULL,
    "imageName" VARCHAR(255),
    "options" TEXT[],
    "correctIndex" INTEGER,
    "correctOrder" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessQuestion" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "type" "QType" NOT NULL DEFAULT 'MCQ',
    "stem" TEXT NOT NULL,
    "imageName" VARCHAR(255),
    "options" TEXT[],
    "points" INTEGER NOT NULL DEFAULT 10,
    "position" INTEGER NOT NULL DEFAULT 0,
    "correctIndex" INTEGER,
    "correctOrder" INTEGER[] DEFAULT ARRAY[]::INTEGER[],

    CONSTRAINT "AssessQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessAttempt" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "qOrder" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "optOrders" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "score" INTEGER,
    "maxScore" INTEGER,
    "gradedById" TEXT,

    CONSTRAINT "AssessAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessAnswer" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "pickedIndex" INTEGER,
    "pickedOrder" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "isCorrect" BOOLEAN,
    "points" INTEGER,

    CONSTRAINT "AssessAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyGroup" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "StudyGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyGroupMember" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,

    CONSTRAINT "StudyGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "dedupeKey" VARCHAR(128),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Assessment_schoolId_classId_publishAt_idx" ON "Assessment"("schoolId", "classId", "publishAt");

-- CreateIndex
CREATE INDEX "Assessment_schoolId_authorId_idx" ON "Assessment"("schoolId", "authorId");

-- CreateIndex
CREATE INDEX "Question_schoolId_subjectId_idx" ON "Question"("schoolId", "subjectId");

-- CreateIndex
CREATE INDEX "Question_schoolId_authorId_idx" ON "Question"("schoolId", "authorId");

-- CreateIndex
CREATE INDEX "AssessQuestion_schoolId_assessmentId_position_idx" ON "AssessQuestion"("schoolId", "assessmentId", "position");

-- CreateIndex
CREATE INDEX "AssessAttempt_schoolId_assessmentId_idx" ON "AssessAttempt"("schoolId", "assessmentId");

-- CreateIndex
CREATE INDEX "AssessAttempt_schoolId_studentId_idx" ON "AssessAttempt"("schoolId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessAttempt_assessmentId_studentId_key" ON "AssessAttempt"("assessmentId", "studentId");

-- CreateIndex
CREATE INDEX "AssessAnswer_schoolId_attemptId_idx" ON "AssessAnswer"("schoolId", "attemptId");

-- CreateIndex
CREATE INDEX "AssessAnswer_schoolId_questionId_idx" ON "AssessAnswer"("schoolId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessAnswer_attemptId_questionId_key" ON "AssessAnswer"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "StudyGroup_schoolId_assessmentId_idx" ON "StudyGroup"("schoolId", "assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyGroup_assessmentId_name_key" ON "StudyGroup"("assessmentId", "name");

-- CreateIndex
CREATE INDEX "StudyGroupMember_schoolId_groupId_idx" ON "StudyGroupMember"("schoolId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyGroupMember_assessmentId_studentId_key" ON "StudyGroupMember"("assessmentId", "studentId");

-- CreateIndex
CREATE INDEX "ExpLog_schoolId_studentId_createdAt_idx" ON "ExpLog"("schoolId", "studentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExpLog_schoolId_dedupeKey_key" ON "ExpLog"("schoolId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "ParentalConsent" ADD CONSTRAINT "ParentalConsent_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessQuestion" ADD CONSTRAINT "AssessQuestion_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessQuestion" ADD CONSTRAINT "AssessQuestion_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessAttempt" ADD CONSTRAINT "AssessAttempt_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessAttempt" ADD CONSTRAINT "AssessAttempt_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessAttempt" ADD CONSTRAINT "AssessAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessAttempt" ADD CONSTRAINT "AssessAttempt_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessAnswer" ADD CONSTRAINT "AssessAnswer_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessAnswer" ADD CONSTRAINT "AssessAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AssessAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessAnswer" ADD CONSTRAINT "AssessAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssessQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroup" ADD CONSTRAINT "StudyGroup_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroup" ADD CONSTRAINT "StudyGroup_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroupMember" ADD CONSTRAINT "StudyGroupMember_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroupMember" ADD CONSTRAINT "StudyGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroupMember" ADD CONSTRAINT "StudyGroupMember_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGroupMember" ADD CONSTRAINT "StudyGroupMember_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpLog" ADD CONSTRAINT "ExpLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpLog" ADD CONSTRAINT "ExpLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
