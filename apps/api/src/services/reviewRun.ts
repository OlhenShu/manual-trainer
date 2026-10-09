import type { Answer, ReviewResult, Rubric } from '@manual-trainer/shared';
import { providerReviewSchema } from '@manual-trainer/shared';
import { Prisma } from '../generated/prisma/client.js';
import { db } from '../db.js';
import { finalizeReview, localReview, parseRubric, reviewDailyLimit } from './reviewScore.js';

type ProviderName = 'local' | 'openai' | 'anthropic';

interface ProviderCall {
  review: ReturnType<typeof localReview>;
  provider: ProviderName;
  model: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
}

export type StoredAttempt = {
  id: string;
  scenarioId: string;
  createdAt: Date;
  answer: unknown;
  reviewStatus: 'pending' | 'completed' | 'failed';
  review: unknown;
};

export type ReviewRunResult =
  | { type: 'ok'; attempt: StoredAttempt }
  | { type: 'limited' }
  | { type: 'not_found' };

function resolveProvider(): ProviderName {
  const forced = process.env['REVIEW_PROVIDER'];
  if (forced === 'local' || forced === 'openai' || forced === 'anthropic') {
    return forced;
  }
  if (process.env['OPENAI_API_KEY']) return 'openai';
  if (process.env['ANTHROPIC_API_KEY']) return 'anthropic';
  return 'local';
}

function estimateCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const perMillion: Record<string, [number, number]> = {
    'gpt-4o-mini': [0.15, 0.6],
    'claude-haiku-5-5': [0.1, 0.5],
    'claude-sonnet-5-5': [2, 10],
    'claude-sonnet-4-5': [3, 15],
  };
  const rates = perMillion[model] ?? [0, 0];
  return (promptTokens * rates[0] + completionTokens * rates[1]) / 1_000_000;
}

function reviewJsonSchema(rubric: Rubric): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['criteria', 'feedback'],
    properties: {
      feedback: { type: 'string' },
      criteria: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['criterionId', 'score', 'comment'],
          properties: {
            criterionId: { type: 'string', enum: rubric.criteria.map((criterion) => criterion.id) },
            score: { type: 'integer' },
            comment: { type: 'string' },
          },
        },
      },
    },
  };
}

function reviewPrompt(
  rubric: Rubric,
  referenceSolution: string,
  answer: Answer,
  defects: string[],
): string {
  const lines = [
    'Оціни відповідь студента лише за рубрикою і еталонним рішенням.',
    'Не додавай власних критеріїв і не оцінюй те, чого немає в рубриці.',
    'score — ціле число від 0 до weight відповідного критерію.',
    'comment і feedback українською, на «ви», без осуду: поясни, що покращити.',
    '',
    `Рубрика: ${JSON.stringify(rubric)}`,
    '',
    `Еталон: ${referenceSolution}`,
    '',
    `Відповідь: ${JSON.stringify(answer)}`,
  ];
  if (defects.length > 0) {
    lines.push('', `Вбудовані дефекти, які треба знайти і виправити: ${JSON.stringify(defects)}`);
  }
  return lines.join('\n');
}

async function callOpenAi(
  rubric: Rubric,
  referenceSolution: string,
  answer: Answer,
  defects: string[],
): Promise<ProviderCall> {
  const model = process.env['OPENAI_MODEL'] ?? 'gpt-4o-mini';
  const key = process.env['OPENAI_API_KEY'];
  if (!key) throw new Error('OPENAI_API_KEY is not set.');
  const started = Date.now();
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(30_000),
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'Ти перевіряєш навчальні відповіді manual QA. Відповідай лише JSON за схемою.' },
        { role: 'user', content: reviewPrompt(rubric, referenceSolution, answer, defects) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'review', strict: true, schema: reviewJsonSchema(rubric) },
      },
    }),
  });
  if (!response.ok) throw new Error(`OpenAI request failed with status ${response.status}.`);
  const body = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI response did not include content.');
  return {
    review: providerReviewSchema.parse(JSON.parse(content)),
    provider: 'openai',
    model,
    promptTokens: body.usage?.prompt_tokens ?? 0,
    completionTokens: body.usage?.completion_tokens ?? 0,
    durationMs: Date.now() - started,
  };
}

async function callAnthropic(
  rubric: Rubric,
  referenceSolution: string,
  answer: Answer,
  defects: string[],
): Promise<ProviderCall> {
  const model = process.env['ANTHROPIC_MODEL'] ?? 'claude-haiku-5-5';
  const key = process.env['ANTHROPIC_API_KEY'];
  const workspaceId = process.env['ANTHROPIC_WORKSPACE_ID'];
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set.');
  const started = Date.now();
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: AbortSignal.timeout(30_000),
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
      ...(workspaceId ? { 'anthropic-workspace-id': workspaceId } : {}),
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      tools: [
        {
          name: 'submit_review',
          description: 'Submit the structured review.',
          input_schema: reviewJsonSchema(rubric),
        },
      ],
      tool_choice: { type: 'tool', name: 'submit_review' },
      messages: [{ role: 'user', content: reviewPrompt(rubric, referenceSolution, answer, defects) }],
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Anthropic request failed with status ${response.status}: ${detail}`);
  }
  const body = (await response.json()) as {
    content?: { type?: string; name?: string; input?: unknown }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const tool = body.content?.find((block) => block.type === 'tool_use' && block.name === 'submit_review');
  if (!tool?.input) throw new Error('Anthropic response did not include a review.');
  return {
    review: providerReviewSchema.parse(tool.input),
    provider: 'anthropic',
    model,
    promptTokens: body.usage?.input_tokens ?? 0,
    completionTokens: body.usage?.output_tokens ?? 0,
    durationMs: Date.now() - started,
  };
}

async function callProvider(
  rubric: Rubric,
  referenceSolution: string,
  answer: Answer,
  defects: string[],
): Promise<ProviderCall> {
  const provider = resolveProvider();
  if (provider === 'openai') return callOpenAi(rubric, referenceSolution, answer, defects);
  if (provider === 'anthropic') return callAnthropic(rubric, referenceSolution, answer, defects);
  const started = Date.now();
  return {
    review: localReview(rubric, answer),
    provider: 'local',
    model: 'local',
    promptTokens: 0,
    completionTokens: 0,
    durationMs: Date.now() - started,
  };
}

async function completedReviewsToday(userId: string): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return db.attempt.count({
    where: {
      userId,
      reviewStatus: 'completed',
      reviewedAt: { gte: start },
    },
  });
}

export async function isReviewLimited(user: { id: string; role: string }): Promise<boolean> {
  if (user.role === 'admin') return false;
  const used = await completedReviewsToday(user.id);
  if (used < reviewDailyLimit()) return false;
  const record = await db.user.findUnique({ where: { id: user.id }, select: { reviewCredits: true } });
  return (record?.reviewCredits ?? 0) <= 0;
}

export async function reviewStoredAttempt(
  attemptId: string,
  user: { id: string; role: string },
): Promise<ReviewRunResult> {
  const attempt = await db.attempt.findFirst({
    where: { id: attemptId, userId: user.id },
    include: { scenario: true },
  });
  if (!attempt || attempt.scenario.status !== 'published') {
    return { type: 'not_found' };
  }
  if (attempt.reviewStatus === 'completed') {
    return { type: 'ok', attempt };
  }

  if (await isReviewLimited(user)) {
    return { type: 'limited' };
  }

  const rubric = parseRubric(attempt.scenario.rubric);
  const answer = attempt.answer as Answer;
  let review: ReviewResult | null = null;
  let succeeded = false;
  let provider: ProviderName = resolveProvider();
  let model: string = provider;
  let promptTokens = 0;
  let completionTokens = 0;
  let durationMs = 0;

  if (rubric) {
    try {
      const defects = Array.isArray(attempt.scenario.embeddedDefects)
        ? attempt.scenario.embeddedDefects.filter((item): item is string => typeof item === 'string')
        : [];
      const call = await callProvider(rubric, attempt.scenario.referenceSolution, answer, defects);
      provider = call.provider;
      model = call.model;
      promptTokens = call.promptTokens;
      completionTokens = call.completionTokens;
      durationMs = call.durationMs;
      review = finalizeReview(rubric, call.review, attempt.scenario.passingThreshold);
      succeeded = true;
    } catch (err) {
      console.error('[Review failed]', err);
      succeeded = false;
    }

    await db.aiCallLog.create({
      data: {
        attemptId: attempt.id,
        userId: user.id,
        provider,
        model,
        promptTokens,
        completionTokens,
        costUsd: estimateCostUsd(model, promptTokens, completionTokens),
        durationMs,
        succeeded,
      },
    });
  }

  const updated = await db.attempt.update({
    where: { id: attempt.id },
    data: {
      reviewStatus: succeeded ? 'completed' : 'failed',
      review: succeeded && review ? (review as Prisma.InputJsonValue) : Prisma.DbNull,
      reviewedAt: new Date(),
    },
  });

  if (succeeded && user.role !== 'admin' && (await completedReviewsToday(user.id)) > reviewDailyLimit()) {
    await db.user.updateMany({
      where: { id: user.id, reviewCredits: { gt: 0 } },
      data: { reviewCredits: { decrement: 1 } },
    });
  }

  return { type: 'ok', attempt: updated };
}
