import { CircleAlert, CircleCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useProgress } from "@/api/progress";
import { ApiError } from "@/api/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { translateApiError } from "@/lib/translateError";

export function ProgressSummary() {
  const { t } = useTranslation("catalog");
  const { t: tErrors } = useTranslation("errors");
  const progress = useProgress();

  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold tracking-tight">{t("progressTitle")}</h2>
      {progress.isPending ? (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {t("progressLoading")}
        </p>
      ) : null}
      {progress.isError ? (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>
            {t("progressError")}{" "}
            {translateApiError(tErrors, progress.error instanceof ApiError ? progress.error.code : "INTERNAL_ERROR")}
          </AlertDescription>
        </Alert>
      ) : null}
      {progress.isSuccess && progress.data.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("progressEmpty")}</p>
      ) : null}
      {progress.data && progress.data.length > 0 ? (
        <ul className="mt-4 divide-y rounded-xl border bg-card">
          {progress.data.map((item) => (
            <li key={item.scenarioId}>
              <Link
                to={`/scenarios/${item.scenarioId}`}
                className="block p-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <p className="font-medium">{item.title}</p>
                <p
                  className={
                    item.passed
                      ? "mt-1 flex items-center gap-2 text-sm font-medium text-success"
                      : "mt-1 flex items-center gap-2 text-sm font-medium text-danger"
                  }
                >
                  {item.passed ? <CircleCheck className="size-4" aria-hidden /> : <CircleAlert className="size-4" aria-hidden />}
                  {item.passed ? t("passed") : t("notPassed")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("firstScore", { score: item.firstScore })}
                  {" · "}
                  {t("bestScore", { score: item.bestScore })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
