import { adminStatsSchema, reviewResultSchema, type AdminStats } from '@manual-trainer/shared';
import { db } from '../db.js';

const ACTIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export async function loadAdminStats(): Promise<AdminStats> {
  const since = new Date(Date.now() - ACTIVE_WINDOW_MS);
  const [attempts, active, cost, students] = await Promise.all([
    db.attempt.findMany({
      where: { reviewStatus: 'completed' },
      orderBy: { createdAt: 'asc' },
      select: {
        userId: true,
        scenarioId: true,
        createdAt: true,
        review: true,
        scenario: { select: { id: true, title: true } },
        user: { select: { role: true } },
      },
    }),
    db.attempt.findMany({
      where: { createdAt: { gte: since } },
      select: { userId: true },
      distinct: ['userId'],
    }),
    db.aiCallLog.aggregate({ _sum: { costUsd: true } }),
    db.user.findMany({
      select: { id: true, email: true, emailVerifiedAt: true, role: true, reviewCredits: true },
      orderBy: { email: 'asc' },
    }),
  ]);

  const parsed = attempts.flatMap((attempt) => {
    const review = reviewResultSchema.safeParse(attempt.review);
    if (!review.success) return [];
    return [{ ...attempt, review: review.data }];
  });

  const firstKeys = new Set<string>();
  const firstScores: number[] = [];
  const scenarioBuckets = new Map<
    string,
    { title: string; scores: number[]; firstScores: number[]; passed: number }
  >();
  const weak = new Map<string, number>();
  const studentBuckets = new Map<
    string,
    Map<
      string,
      {
        title: string;
        scores: number[];
        firstScore: number;
        bestScore: number;
        passedAttempts: number;
        passed: boolean;
      }
    >
  >();

  for (const attempt of parsed) {
    const key = `${attempt.userId}:${attempt.scenarioId}`;
    const bucket = scenarioBuckets.get(attempt.scenarioId) ?? {
      title: attempt.scenario.title,
      scores: [],
      firstScores: [],
      passed: 0,
    };
    bucket.scores.push(attempt.review.percent);
    if (attempt.review.passed) bucket.passed += 1;
    if (!firstKeys.has(key)) {
      firstKeys.add(key);
      firstScores.push(attempt.review.percent);
      bucket.firstScores.push(attempt.review.percent);
    }
    for (const criterion of attempt.review.criteria) {
      if (criterion.score * 100 < criterion.maxScore * 60) {
        weak.set(criterion.title, (weak.get(criterion.title) ?? 0) + 1);
      }
    }
    scenarioBuckets.set(attempt.scenarioId, bucket);
    const scenariosForStudent = studentBuckets.get(attempt.userId) ?? new Map();
    const studentScenario = scenariosForStudent.get(attempt.scenarioId);
    if (!studentScenario) {
      scenariosForStudent.set(attempt.scenarioId, {
        title: attempt.scenario.title,
        scores: [attempt.review.percent],
        firstScore: attempt.review.percent,
        bestScore: attempt.review.percent,
        passedAttempts: attempt.review.passed ? 1 : 0,
        passed: attempt.review.passed,
      });
    } else {
      studentScenario.scores.push(attempt.review.percent);
      studentScenario.bestScore = Math.max(studentScenario.bestScore, attempt.review.percent);
      if (attempt.review.passed) studentScenario.passedAttempts += 1;
      studentScenario.passed = studentScenario.passed || attempt.review.passed;
    }
    studentBuckets.set(attempt.userId, scenariosForStudent);
  }

  const scores = parsed.map((attempt) => attempt.review.percent);
  const passed = parsed.filter((attempt) => attempt.review.passed).length;

  return adminStatsSchema.parse({
    activeUsers: active.length,
    attempts: parsed.length,
    averageScore: average(scores),
    averageFirstScore: average(firstScores),
    successRate: parsed.length === 0 ? null : Math.round((passed / parsed.length) * 100),
    aiCostUsd: cost._sum.costUsd ?? 0,
    scenarios: [...scenarioBuckets.entries()].map(([id, bucket]) => ({
      id,
      title: bucket.title,
      attempts: bucket.scores.length,
      averageScore: average(bucket.scores),
      averageFirstScore: average(bucket.firstScores),
      successRate:
        bucket.scores.length === 0 ? null : Math.round((bucket.passed / bucket.scores.length) * 100),
    })),
    students: students.map((student) => {
      const scenarioMap = studentBuckets.get(student.id) ?? new Map();
      const scenarioStats = [...scenarioMap.entries()].map(([scenarioId, item]) => ({
        scenarioId,
        title: item.title,
        attempts: item.scores.length,
        firstScore: item.firstScore,
        bestScore: item.bestScore,
        passed: item.passed,
      }));
      const scores = [...scenarioMap.values()].flatMap((item) => item.scores);
      const firstScores = [...scenarioMap.values()].map((item) => item.firstScore);
      const passedAttempts = [...scenarioMap.values()].reduce((sum, item) => sum + item.passedAttempts, 0);
      return {
        id: student.id,
        email: student.email,
        attempts: scores.length,
        averageScore: average(scores),
        averageFirstScore: average(firstScores),
        successRate: scores.length === 0 ? null : Math.round((passedAttempts / scores.length) * 100),
        passedScenarios: scenarioStats.filter((item) => item.passed).length,
        emailVerified: student.emailVerifiedAt !== null,
        role: student.role,
        reviewCredits: student.reviewCredits,
        scenarios: scenarioStats,
      };
    }).sort((left, right) => right.attempts - left.attempts || left.email.localeCompare(right.email)),
    weakCriteria: [...weak.entries()]
      .map(([title, failedCount]) => ({ title, failedCount }))
      .sort((left, right) => right.failedCount - left.failedCount)
      .slice(0, 5),
  });
}
