-- CreateTable
CREATE TABLE "ExpBadge" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "target" VARCHAR(64) NOT NULL DEFAULT 'ALL',
    "publishAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollabThread" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "recipients" TEXT[],
    "revealedAt" TIMESTAMP(3),
    "revealedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollabThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollabMessage" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "fileName" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollabMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpBadge_schoolId_studentId_idx" ON "ExpBadge"("schoolId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpBadge_studentId_name_key" ON "ExpBadge"("studentId", "name");

-- CreateIndex
CREATE INDEX "Announcement_schoolId_publishAt_idx" ON "Announcement"("schoolId", "publishAt");

-- CreateIndex
CREATE INDEX "Announcement_schoolId_target_idx" ON "Announcement"("schoolId", "target");

-- CreateIndex
CREATE INDEX "CollabThread_schoolId_senderId_idx" ON "CollabThread"("schoolId", "senderId");

-- CreateIndex
CREATE INDEX "CollabMessage_schoolId_threadId_createdAt_idx" ON "CollabMessage"("schoolId", "threadId", "createdAt");

-- AddForeignKey
ALTER TABLE "ExpBadge" ADD CONSTRAINT "ExpBadge_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpBadge" ADD CONSTRAINT "ExpBadge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollabThread" ADD CONSTRAINT "CollabThread_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollabThread" ADD CONSTRAINT "CollabThread_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollabMessage" ADD CONSTRAINT "CollabMessage_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollabMessage" ADD CONSTRAINT "CollabMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "CollabThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
