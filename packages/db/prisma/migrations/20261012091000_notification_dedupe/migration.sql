ALTER TABLE "Notification" ADD COLUMN "dedupeKey" VARCHAR(128);
CREATE UNIQUE INDEX "Notification_schoolId_dedupeKey_key" ON "Notification"("schoolId", "dedupeKey");
