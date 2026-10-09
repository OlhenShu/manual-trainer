import type { Answer, ProviderReview, ReviewResult, Rubric } from '@manual-trainer/shared';
import { providerReviewSchema, reviewResultSchema, rubricSchema } from '@manual-trainer/shared';

const UNSUCCESSFUL_ATTEMPTS_BEFORE_REFERENCE = 3;

export function isReferenceUnlocked(results: { passed: boolean }[]): boolean {
  const unsuccessful = results.filter((result) => !result.passed).length;
  return results.some((result) => result.passed) || unsuccessful >= UNSUCCESSFUL_ATTEMPTS_BEFORE_REFERENCE;
}

export function reviewDailyLimit(): number {
  const raw = Number(process.env['REVIEW_DAILY_LIMIT'] ?? '20');
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 20;
}

export function flattenAnswer(answer: Answer): string {
  const parts: string[] = [];
  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      parts.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value && typeof value === 'object') {
      Object.values(value).forEach(visit);
    }
  };
  visit(answer);
  return parts.join('\n');
}

function tokens(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/\p{L}{4,}/gu) ?? []);
}

export function localReview(rubric: Rubric, answer: Answer): ProviderReview {
  const answerTokens = tokens(flattenAnswer(answer));
  const criteria = rubric.criteria.map((criterion) => {
    const keys = tokens(`${criterion.title} ${criterion.description}`);
    const matched = [...keys].filter((word) => answerTokens.has(word)).length;
    const ratio = keys.size === 0 ? 0 : matched / keys.size;
    const score = Math.min(criterion.weight, Math.round(criterion.weight * ratio));
    const comment =
      ratio >= 0.6
        ? `Критерій «${criterion.title}» покрито. Залишайте формулювання конкретними.`
        : `Посильте критерій «${criterion.title}»: ${criterion.description}`;
    return { criterionId: criterion.id, score, comment };
  });

  const weak = rubric.criteria.filter((criterion) => {
    const scored = criteria.find((item) => item.criterionId === criterion.id);
    return !scored || scored.score < criterion.weight * 0.6;
  });
  const feedback =
    weak.length === 0
      ? 'Відповідь покриває критерії рубрики. Звірте формулювання з умовою ще раз перед наступною спробою.'
      : `Варто посилити: ${weak.map((criterion) => criterion.title).join(', ')}. Орієнтуйтеся на опис кожного критерію.`;

  return providerReviewSchema.parse({ criteria, feedback });
}

export function finalizeReview(
  rubric: Rubric,
  providerReview: ProviderReview,
  passingThreshold: number,
): ReviewResult {
  const byId = new Map(providerReview.criteria.map((item) => [item.criterionId, item]));
  if (byId.size !== providerReview.criteria.length || byId.size !== rubric.criteria.length) {
    throw new Error('Review criteria do not match the rubric.');
  }

  const criteria = rubric.criteria.map((criterion) => {
    const scored = byId.get(criterion.id);
    if (!scored || scored.score > criterion.weight) {
      throw new Error(`Invalid score for criterion ${criterion.id}.`);
    }
    return {
      criterionId: criterion.id,
      title: criterion.title,
      score: scored.score,
      maxScore: criterion.weight,
      comment: scored.comment.trim() || `Немає окремого коментаря для критерію «${criterion.title}».`,
    };
  });

  const totalScore = criteria.reduce((sum, item) => sum + item.score, 0);
  const maxScore = criteria.reduce((sum, item) => sum + item.maxScore, 0);
  const percent = maxScore === 0 ? 0 : Math.round((totalScore / maxScore) * 100);
  const feedback = providerReview.feedback.trim() || 'Перевірте відповідь за кожним критерієм рубрики.';

  return reviewResultSchema.parse({
    criteria,
    totalScore,
    maxScore,
    percent,
    passed: percent >= passingThreshold,
    feedback,
  });
}

export function parseRubric(value: unknown): Rubric | undefined {
  const parsed = rubricSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
