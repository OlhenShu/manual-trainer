import type { Answer, Rubric } from '@manual-trainer/shared';
import { describe, expect, it } from 'vitest';
import { finalizeReview, isReferenceUnlocked, localReview } from './reviewScore.js';

const rubric: Rubric = {
  criteria: [
    {
      id: 'steps',
      title: 'Кроки',
      description: 'Кроки відтворювані, повні і йдуть у правильному порядку.',
      weight: 100,
    },
  ],
};

const thinAnswer: Answer = {
  taskType: 'test_case',
  name: 'Тест',
  preconditions: 'Немає',
  steps: [{ text: 'Крок' }],
  expectedResult: 'Результат',
  priority: 'medium',
};

describe('local review', () => {
  it('scores a thin answer below the default passing threshold', () => {
    const review = finalizeReview(rubric, localReview(rubric, thinAnswer), 70);
    expect(review.passed).toBe(false);
    expect(review.percent).toBeLessThan(70);
    expect(review.criteria[0]?.comment).toContain('Кроки');
  });

  it('scores an answer that uses the rubric wording as passed', () => {
    const answer: Answer = {
      ...thinAnswer,
      steps: [
        {
          text: 'Кроки відтворювані, повні і йдуть у правильному порядку від першого до останнього.',
        },
      ],
    };
    const review = finalizeReview(rubric, localReview(rubric, answer), 70);
    expect(review.passed).toBe(true);
  });
});

describe('reference solution unlock', () => {
  it('stays locked until a pass or three unsuccessful reviews', () => {
    expect(isReferenceUnlocked([])).toBe(false);
    expect(isReferenceUnlocked([{ passed: false }, { passed: false }])).toBe(false);
    expect(isReferenceUnlocked([{ passed: false }, { passed: false }, { passed: false }])).toBe(true);
    expect(isReferenceUnlocked([{ passed: true }])).toBe(true);
  });
});
