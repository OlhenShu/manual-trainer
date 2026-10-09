-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('test_case', 'bug_report', 'requirements_analysis', 'requirements_composition');

-- CreateEnum
CREATE TYPE "ScenarioMode" AS ENUM ('fix', 'create');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('easy', 'medium', 'hard');

-- CreateEnum
CREATE TYPE "ScenarioStatus" AS ENUM ('draft', 'published');

-- CreateTable
CREATE TABLE "scenarios" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "taskType" "TaskType" NOT NULL,
    "mode" "ScenarioMode" NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "status" "ScenarioStatus" NOT NULL DEFAULT 'draft',
    "prompt" TEXT NOT NULL,
    "passingThreshold" INTEGER NOT NULL DEFAULT 70,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scenarios_slug_key" ON "scenarios"("slug");

-- CreateIndex
CREATE INDEX "scenarios_status_taskType_mode_difficulty_idx" ON "scenarios"("status", "taskType", "mode", "difficulty");
