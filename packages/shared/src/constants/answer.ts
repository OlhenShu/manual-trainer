export const PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

export const SEVERITY = {
  MINOR: 'minor',
  MAJOR: 'major',
  CRITICAL: 'critical',
  BLOCKER: 'blocker',
} as const;

export const ISSUE_TYPE = {
  CONTRADICTION: 'contradiction',
  AMBIGUITY: 'ambiguity',
  GAP: 'gap',
} as const;

export const priorityValues = [PRIORITY.LOW, PRIORITY.MEDIUM, PRIORITY.HIGH] as const;
export const severityValues = [
  SEVERITY.MINOR,
  SEVERITY.MAJOR,
  SEVERITY.CRITICAL,
  SEVERITY.BLOCKER,
] as const;
export const issueTypeValues = [
  ISSUE_TYPE.CONTRADICTION,
  ISSUE_TYPE.AMBIGUITY,
  ISSUE_TYPE.GAP,
] as const;

export type Priority = (typeof priorityValues)[number];
export type Severity = (typeof severityValues)[number];
export type IssueType = (typeof issueTypeValues)[number];
