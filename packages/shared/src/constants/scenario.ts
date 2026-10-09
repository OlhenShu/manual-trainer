export const TASK_TYPE = {
  TEST_CASE: 'test_case',
  BUG_REPORT: 'bug_report',
  REQUIREMENTS_ANALYSIS: 'requirements_analysis',
  REQUIREMENTS_COMPOSITION: 'requirements_composition',
} as const;

export const SCENARIO_MODE = {
  FIX: 'fix',
  CREATE: 'create',
} as const;

export const DIFFICULTY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
} as const;

export const taskTypeValues = [
  TASK_TYPE.TEST_CASE,
  TASK_TYPE.BUG_REPORT,
  TASK_TYPE.REQUIREMENTS_ANALYSIS,
  TASK_TYPE.REQUIREMENTS_COMPOSITION,
] as const;

export const scenarioModeValues = [SCENARIO_MODE.FIX, SCENARIO_MODE.CREATE] as const;

export const difficultyValues = [DIFFICULTY.EASY, DIFFICULTY.MEDIUM, DIFFICULTY.HARD] as const;

export type TaskType = (typeof taskTypeValues)[number];
export type ScenarioMode = (typeof scenarioModeValues)[number];
export type Difficulty = (typeof difficultyValues)[number];
