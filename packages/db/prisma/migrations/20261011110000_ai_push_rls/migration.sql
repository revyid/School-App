-- AI chat persistence and push subscriptions are tenant data.
-- This migration is intentionally fail-closed: every new table has ENABLE + FORCE RLS.
ALTER TABLE "SchoolSettings" ADD COLUMN "ttsPhrase" TEXT NOT NULL DEFAULT '{{name}} sudah hadir';
ALTER TABLE "SchoolSettings" ADD COLUMN "ttsPhraseDup" TEXT NOT NULL DEFAULT '{{name}} sudah di catat';
ALTER TABLE "SchoolSettings" ADD COLUMN "aiChatEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SchoolSettings" ADD COLUMN "aiShareStudentData" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "PushSubscription" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "endpointHash" VARCHAR(64) NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" VARCHAR(500) NOT NULL,
  "userAgent" VARCHAR(300),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PushSubscription_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PushSubscription_userId_endpointHash_key" ON "PushSubscription"("userId", "endpointHash");
CREATE INDEX "PushSubscription_schoolId_idx" ON "PushSubscription"("schoolId");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
CREATE TABLE "AiChatSession" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiChatSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiChatSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AiChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AiChatSession_schoolId_userId_key" ON "AiChatSession"("schoolId", "userId");
CREATE INDEX "AiChatSession_schoolId_userId_idx" ON "AiChatSession"("schoolId", "userId");
CREATE TABLE "AiChatMessage" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "role" VARCHAR(16) NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiChatMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiChatMessage_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AiChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AiChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AiChatMessage_schoolId_sessionId_createdAt_idx" ON "AiChatMessage"("schoolId", "sessionId", "createdAt");
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['PushSubscription','AiChatSession','AiChatMessage'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON public.%I FOR ALL TO app_user USING ("schoolId" = current_setting(''app.school_id'', true)) WITH CHECK ("schoolId" = current_setting(''app.school_id'', true))', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO app_user', t);
  END LOOP;
END $$;
