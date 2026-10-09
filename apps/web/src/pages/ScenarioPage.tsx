import { ERROR_CODE } from "@manual-trainer/shared";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { ApiError } from "@/api/client";
import { useScenario } from "@/api/scenarios";
import { AnswerForm } from "@/components/answers/AnswerForm";
import { AttemptList } from "@/components/answers/AttemptList";
import { AuthLayout } from "@/components/AuthLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { translateApiError } from "@/lib/translateError";

export function ScenarioPage() {
  const { t } = useTranslation("catalog");
  const { t: tAnswers } = useTranslation("answers");
  const { t: tErrors } = useTranslation("errors");
  const { id } = useParams();
  const scenario = useScenario(id);
  const isNotFound = scenario.error instanceof ApiError && scenario.error.code === ERROR_CODE.NOT_FOUND;

  return (
    <AuthLayout>
      <Link
        to="/"
        className="text-sm text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {t("detail.back")}
      </Link>

      {scenario.isPending ? (
        <p role="status" className="mt-6 text-sm text-muted-foreground">
          {t("loading")}
        </p>
      ) : null}

      {scenario.isError ? (
        <Alert variant="destructive" className="mt-6">
          <AlertDescription>
            {isNotFound
              ? t("detail.notFound")
              : translateApiError(
                  tErrors,
                  scenario.error instanceof ApiError ? scenario.error.code : "INTERNAL_ERROR",
                )}
          </AlertDescription>
          {isNotFound ? null : (
            <Button type="button" variant="outline" className="mt-3" onClick={() => void scenario.refetch()}>
              {t("retry")}
            </Button>
          )}
        </Alert>
      ) : null}

      {scenario.data ? (
        <article className="mt-6">
          <h1 className="text-3xl font-semibold tracking-tight">{scenario.data.title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {t(`taskType.${scenario.data.taskType}`)}
            {" · "}
            {t(`mode.${scenario.data.mode}`)}
            {" · "}
            {t(`difficulty.${scenario.data.difficulty}`)}
          </p>
          <p className="mt-2 text-sm">{t("detail.threshold", { percent: scenario.data.passingThreshold })}</p>
          <h2 className="mt-8 text-lg font-semibold">{t("detail.prompt")}</h2>
          <div className="mt-3 rounded-xl border bg-card p-5 text-sm leading-6 whitespace-pre-wrap">
            {scenario.data.prompt}
          </div>
          <section className="mt-8">
            <h2 className="text-lg font-semibold">{tAnswers("referenceTitle")}</h2>
            {scenario.data.referenceSolution ? (
              <div className="mt-3 rounded-xl border bg-card p-5 text-sm leading-6 whitespace-pre-wrap">
                {scenario.data.referenceSolution}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">{tAnswers("referenceLocked")}</p>
            )}
          </section>
          <AnswerForm scenarioId={scenario.data.id} taskType={scenario.data.taskType} />
          <AttemptList scenarioId={scenario.data.id} />
        </article>
      ) : null}
    </AuthLayout>
  );
}
