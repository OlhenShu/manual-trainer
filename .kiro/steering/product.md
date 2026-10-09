# Product Overview

## Purpose

A web-based training application for manual QA engineers. Users practice four types of tasks:

1. **Writing test cases**
2. **Writing bug reports**
3. **Analyzing requirements** (finding ambiguities, contradictions, gaps)
4. **Composing requirements** (user story + acceptance criteria)

## Scenario Modes

Each scenario (task) exists in one of two modes:

- **"Fix the broken"** — the user receives an artifact with deliberately embedded defects and must correct them. The admin explicitly lists the embedded defects; the AI determines which ones were found and fixed.
- **"Create your own"** — the user receives context (a system description or requirement) and creates an artifact from scratch.

## Roles

| Role  | Capabilities |
|-------|-------------|
| **user** | Register, log in, submit answers to published scenarios |
| **admin** | Create, edit, publish scenarios; view statistics |

## Structured Answer Forms

Answers are entered through structured forms matching the task type — not as free text:

| Task type | Fields |
|-----------|--------|
| Test case | Name, preconditions, steps, expected result, priority |
| Bug report | Summary, environment, steps to reproduce, actual result, expected result, severity, priority |
| Requirements analysis | List of issues with issue type and reference to the requirement fragment |
| Requirements composition | User story and acceptance criteria |

## AI Review

- Only authenticated users may submit answers.
- After submission, the AI assistant performs a quick review.
- The AI evaluates the answer strictly against the rubric and reference solution set by the admin — not by its own judgment.
- Review result is structured: score per criterion, total score, brief feedback.

## Rubric & Reference Solution

- Every scenario contains a reference solution and a rubric (criteria with weights) defined by the admin.
- For "Fix the broken" mode, the admin explicitly lists all embedded defects.

## Attempts & Progress

- A user may attempt the same scenario multiple times. The number of AI reviews per user per day is limited (see tech.md).
- Statistics track both the **first-attempt score** and the **best score** across all attempts.
- Time spent on each attempt is recorded and available in statistics, but there is no enforced time limit.
- Users can see their full attempt history for each scenario, including the submitted content and the AI review (criteria scores, total score, feedback).
- The reference solution becomes visible to the user after a **successful attempt** or after **3 unsuccessful attempts** on the same scenario.

## Passing Threshold

- A successful attempt is one where the score is at or above the scenario's passing threshold.
- The threshold is set by the admin per scenario as a **percentage of the maximum score**.
- Default threshold: **70%**.

## Scenario Catalog

- Scenarios are organized by **task type**, **mode**, and **difficulty level** (easy, medium, hard).
- Users discover scenarios through a catalog with filters by task type, mode, and difficulty.
- Admin assignment of scenarios to specific users is out of scope for MVP.

## Admin Statistics

- Number of attempts per scenario
- Average score (overall and first-attempt)
- Success rate (share of passing attempts)
- Criteria most frequently failed
- Active users
- Time spent per attempt
- AI review cost (model, tokens, response time logged per call)

## MVP Scope Notes

- No leaderboard or gamification in MVP. Users see only their personal progress.

## UI Language

The user interface is in **Ukrainian**. Code, variable names, and commits are in **English**.
