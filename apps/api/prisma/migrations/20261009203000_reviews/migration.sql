-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'completed', 'failed');

-- AlterTable
ALTER TABLE "scenarios" ADD COLUMN "referenceSolution" TEXT NOT NULL DEFAULT '';
ALTER TABLE "scenarios" ADD COLUMN "rubric" JSONB NOT NULL DEFAULT '{"criteria":[]}';

-- AlterTable
ALTER TABLE "attempts" ADD COLUMN "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'pending';
ALTER TABLE "attempts" ADD COLUMN "review" JSONB;
ALTER TABLE "attempts" ADD COLUMN "reviewedAt" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "attempts_userId_reviewStatus_reviewedAt_idx" ON "attempts"("userId", "reviewStatus", "reviewedAt");

-- CreateTable
CREATE TABLE "ai_call_logs" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "succeeded" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_call_logs_attemptId_idx" ON "ai_call_logs"("attemptId");

-- AddForeignKey
ALTER TABLE "ai_call_logs" ADD CONSTRAINT "ai_call_logs_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_call_logs" ADD CONSTRAINT "ai_call_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
