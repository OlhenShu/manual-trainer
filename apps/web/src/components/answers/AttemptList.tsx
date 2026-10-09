import type { Answer, ReviewResult } from "@manual-trainer/shared";
import { CircleAlert, CircleCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/api/client";
import { useAttempts, useRetryReview } from "@/api/attempts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { translateApiError } from "@/lib/translateError";

const whenFormat = new Intl.DateTimeFormat("uk", { dateStyle: "medium", timeStyle: "short" });

export function AttemptList({ scenarioId }: { scenarioId: string }) {
  const { t } = useTranslation("answers");
  const { t: tErrors } = useTranslation("errors");
  const attempts = useAttempts(scenarioId);
  const retry = useRetryReview(scenarioId);

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">{t("attemptsTitle")}</h2>
      {attempts.isPending ? (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {t("attemptsLoading")}
        </p>
      ) : null}
      {attempts.isError ? (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>
            {t("attemptsError")}{" "}
            {translateApiError(
              tErrors,
              attempts.error instanceof ApiError ? attempts.error.code : "INTERNAL_ERROR",
            )}
          </AlertDescription>
          <Button type="button" variant="outline" className="mt-3" onClick={() => void attempts.refetch()}>
            {t("retry")}
          </Button>
        </Alert>
      ) : null}
      {attempts.isSuccess && attempts.data.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("attemptsEmpty")}</p>
      ) : null}
      {attempts.data && attempts.data.length > 0 ? (
        <ol className="mt-4 space-y-4">
          {attempts.data.map((attempt) => (
            <li key={attempt.id} className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-medium">
                {t("attemptWhen", { when: whenFormat.format(new Date(attempt.createdAt)) })}
              </h3>
              <ReviewBlock
                attemptId={attempt.id}
                reviewStatus={attempt.reviewStatus}
                review={attempt.review}
                retryPending={retry.isPending && retry.variables === attempt.id}
                retryError={retry.isError && retry.variables === attempt.id ? retry.error : undefined}
                onRetry={() => retry.mutate(attempt.id)}
              />
              <AttemptBody answer={attempt.answer} />
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function ReviewBlock({
  attemptId,
  reviewStatus,
  review,
  retryPending,
  retryError,
  onRetry,
}: {
  attemptId: string;
  reviewStatus: "pending" | "completed" | "failed";
  review: ReviewResult | null;
  retryPending: boolean;
  retryError: unknown;
  onRetry: () => void;
}) {
  const { t } = useTranslation("answers");
  const { t: tErrors } = useTranslation("errors");
  void attemptId;

  if (reviewStatus === "pending") {
    return <p className="mt-3 text-sm text-muted-foreground">{t("reviewPending")}</p>;
  }

  if (reviewStatus === "completed" && review) {
    return (
      <div className="mt-3 space-y-3 text-sm">
        <p className={review.passed ? "flex items-center gap-2 font-medium text-success" : "flex items-center gap-2 font-medium text-danger"}>
          {review.passed ? <CircleCheck className="size-4" aria-hidden /> : <CircleAlert className="size-4" aria-hidden />}
          {review.passed ? t("passed") : t("notPassed")}
          {" · "}
          {t("score", { score: review.totalScore, max: review.maxScore, percent: review.percent })}
        </p>
        <p>
          <span className="text-muted-foreground">{t("feedback")}: </span>
          {review.feedback}
        </p>
        <ul className="space-y-2">
          {review.criteria.map((criterion) => (
            <li key={criterion.criterionId}>
              <p className="font-medium">
                {criterion.title}
                {" · "}
                {t("criterionScore", { score: criterion.score, max: criterion.maxScore })}
              </p>
              <p className="text-muted-foreground">{criterion.comment}</p>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <Alert variant="destructive">
        <AlertDescription>
          {t("reviewFailed")}
          {retryError
            ? ` ${translateApiError(tErrors, retryError instanceof ApiError ? retryError.code : "INTERNAL_ERROR")}`
            : ""}
        </AlertDescription>
        <Button type="button" variant="outline" className="mt-3" disabled={retryPending} onClick={onRetry}>
          {t("reviewRetry")}
        </Button>
      </Alert>
    </div>
  );
}

function AttemptBody({ answer }: { answer: Answer }) {
  const { t } = useTranslation("answers");

  if (answer.taskType === "test_case") {
    return (
      <dl className="mt-3 space-y-2 text-sm">
        <Item term={t("testCase.name")} value={answer.name} />
        <Item term={t("testCase.preconditions")} value={answer.preconditions} />
        <ListItem term={t("testCase.steps")} values={answer.steps.map((step) => step.text)} />
        <Item term={t("testCase.expectedResult")} value={answer.expectedResult} />
        <Item term={t("testCase.priority")} value={t(`priority.${answer.priority}`)} />
      </dl>
    );
  }

  if (answer.taskType === "bug_report") {
    return (
      <dl className="mt-3 space-y-2 text-sm">
        <Item term={t("bugReport.summary")} value={answer.summary} />
        <Item term={t("bugReport.environment")} value={answer.environment} />
        <ListItem term={t("bugReport.steps")} values={answer.stepsToReproduce.map((step) => step.text)} />
        <Item term={t("bugReport.actualResult")} value={answer.actualResult} />
        <Item term={t("bugReport.expectedResult")} value={answer.expectedResult} />
        <Item term={t("bugReport.severity")} value={t(`severity.${answer.severity}`)} />
        <Item term={t("bugReport.priority")} value={t(`priority.${answer.priority}`)} />
      </dl>
    );
  }

  if (answer.taskType === "requirements_analysis") {
    return (
      <ol className="mt-3 space-y-3 text-sm">
        {answer.issues.map((issue, index) => (
          <li key={`${issue.fragment}-${index}`} className="space-y-1">
            <p className="font-medium">{t(`issueType.${issue.issueType}`)}</p>
            <p>{issue.fragment}</p>
            <p className="text-muted-foreground">{issue.description}</p>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <dl className="mt-3 space-y-2 text-sm">
      <Item term={t("composition.userStory")} value={answer.userStory} />
      <ListItem
        term={t("composition.acceptanceCriteria")}
        values={answer.acceptanceCriteria.map((item) => item.text)}
      />
    </dl>
  );
}

function Item({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

function ListItem({ term, values }: { term: string; values: string[] }) {
  return (
    <div>
      <dt className="text-muted-foreground">{term}</dt>
      <dd>
        <ol className="list-decimal pl-5">
          {values.map((value, index) => (
            <li key={`${value}-${index}`}>{value}</li>
          ))}
        </ol>
      </dd>
    </div>
  );
}
