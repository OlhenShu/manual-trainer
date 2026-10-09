import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useScenarios } from "@/api/scenarios";
import { ApiError } from "@/api/client";
import { AuthLayout } from "@/components/AuthLayout";
import { ProgressSummary } from "@/components/ProgressSummary";
import { ScenarioCard } from "@/components/ScenarioCard";
import { ScenarioFilters, type CatalogFilters } from "@/components/ScenarioFilters";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { translateApiError } from "@/lib/translateError";

export function HomePage() {
  const { t } = useTranslation("auth");
  const { t: tCatalog } = useTranslation("catalog");
  const { t: tErrors } = useTranslation("errors");
  const { currentUser } = useAuth();
  const [filters, setFilters] = useState<CatalogFilters>({});
  const scenarios = useScenarios();

  const visible = useMemo(() => {
    return (scenarios.data ?? []).filter((scenario) => {
      if (filters.taskType && scenario.taskType !== filters.taskType) return false;
      if (filters.mode && scenario.mode !== filters.mode) return false;
      if (filters.difficulty && scenario.difficulty !== filters.difficulty) return false;
      return true;
    });
  }, [filters, scenarios.data]);

  return (
    <AuthLayout wide>
      <p className="text-xs font-medium tracking-wide text-primary uppercase">{t("home.eyebrow")}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        {currentUser ? t("home.greeting", { email: currentUser.email }) : null}
      </h1>
      <ProgressSummary />
      <h2 className="mt-8 text-xl font-semibold tracking-tight">{tCatalog("title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{tCatalog("description")}</p>
      <ScenarioFilters value={filters} onChange={setFilters} />

      {scenarios.isPending ? (
        <p role="status" className="mt-6 text-sm text-muted-foreground">
          {tCatalog("loading")}
        </p>
      ) : null}

      {scenarios.isError ? (
        <Alert variant="destructive" className="mt-6">
          <AlertDescription>
            {tCatalog("loadError")}{" "}
            {translateApiError(tErrors, scenarios.error instanceof ApiError ? scenarios.error.code : "INTERNAL_ERROR")}
          </AlertDescription>
          <Button type="button" variant="outline" className="mt-3" onClick={() => void scenarios.refetch()}>
            {tCatalog("retry")}
          </Button>
        </Alert>
      ) : null}

      {scenarios.isSuccess && visible.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{tCatalog("empty")}</p>
      ) : null}

      {scenarios.isSuccess && visible.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {visible.map((scenario) => (
            <ScenarioCard key={scenario.id} scenario={scenario} />
          ))}
        </div>
      ) : null}
    </AuthLayout>
  );
}
