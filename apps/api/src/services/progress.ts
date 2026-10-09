import { progressListSchema, reviewResultSchema, type ProgressItem } from '@manual-trainer/shared';
import { db } from '../db.js';

export async function loadProgress(userId: string): Promise<ProgressItem[]> {
  const attempts = await db.attempt.findMany({
    where: { userId, reviewStatus: 'completed', scenario: { status: 'published' } },
    orderBy: { createdAt: 'asc' },
    select: {
      scenarioId: true,
      createdAt: true,
      review: true,
      scenario: { select: { title: true } },
    },
  });

  const grouped = new Map<string, ProgressItem & { latest: Date }>();
  for (const attempt of attempts) {
    const review = reviewResultSchema.safeParse(attempt.review);
    if (!review.success) continue;
    const current = grouped.get(attempt.scenarioId);
    if (!current) {
      grouped.set(attempt.scenarioId, {
        scenarioId: attempt.scenarioId,
        title: attempt.scenario.title,
        firstScore: review.data.percent,
        bestScore: review.data.percent,
        passed: review.data.passed,
        latest: attempt.createdAt,
      });
      continue;
    }
    current.bestScore = Math.max(current.bestScore, review.data.percent);
    current.passed = current.passed || review.data.passed;
    if (attempt.createdAt > current.latest) current.latest = attempt.createdAt;
  }

  return progressListSchema.parse(
    [...grouped.values()]
      .sort((left, right) => right.latest.getTime() - left.latest.getTime())
      .map(({ latest: _latest, ...item }) => item),
  );
}
