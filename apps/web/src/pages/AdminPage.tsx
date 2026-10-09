import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ApiError, apiRequest } from "@/api/client";
import { useAdminScenarios, useAdminStats, useDeleteStudent, useUpdateStudent } from "@/api/admin";
import { AuthLayout } from "@/components/AuthLayout";
import { StudentRoster } from "@/components/StudentRoster";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { translateApiError } from "@/lib/translateError";

const money = new Intl.NumberFormat("uk", { style: "currency", currency: "USD", maximumFractionDigits: 4 });

export function AdminPage() {
  const { t } = useTranslation("auth");
  const { t: tAdmin } = useTranslation("admin");
  const { t: tCatalog } = useTranslation("catalog");
  const { t: tErrors } = useTranslation("errors");
  const ping = useQuery({
    queryKey: ["admin", "ping"],
    retry: false,
    queryFn: () => apiRequest<{ message: string }>("/api/admin/ping"),
  });
  const scenarios = useAdminScenarios();
  const stats = useAdminStats();
  const deleteStudent = useDeleteStudent();
  const updateStudent = useUpdateStudent();

  const pingError =
    ping.error instanceof ApiError
      ? translateApiError(tErrors, ping.error.code)
      : ping.error
        ? t("admin.pingError")
        : null;

  return (
    <AuthLayout wide>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{t("admin.title")}</h1>
        <Button asChild>
          <Link to="/admin/scenarios/new">{tAdmin("create")}</Link>
        </Button>
      </div>
      {ping.isPending ? <p role="status" className="mt-2 text-sm text-muted-foreground">{t("admin.pingLoading")}</p> : null}
      {pingError ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{pingError}</AlertDescription>
        </Alert>
      ) : null}
      {ping.isSuccess ? <p className="mt-2 text-sm text-muted-foreground">{t("admin.pingSuccess", { message: ping.data.message })}</p> : null}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{tAdmin("statsTitle")}</h2>
        {stats.isPending ? <p className="mt-3 text-sm text-muted-foreground">{tAdmin("statsLoading")}</p> : null}
        {stats.isError ? (
          <Alert variant="destructive" className="mt-3">
            <AlertDescription>
              {tAdmin("statsError")}{" "}
              {translateApiError(tErrors, stats.error instanceof ApiError ? stats.error.code : "INTERNAL_ERROR")}
            </AlertDescription>
          </Alert>
        ) : null}
        {stats.data ? (
          <>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <Stat term={tAdmin("activeUsers")} value={String(stats.data.activeUsers)} />
              <Stat term={tAdmin("attempts")} value={String(stats.data.attempts)} />
              <Stat term={tAdmin("averageScore")} value={stats.data.averageScore === null ? tAdmin("noScore") : `${stats.data.averageScore}%`} />
              <Stat term={tAdmin("averageFirstScore")} value={stats.data.averageFirstScore === null ? tAdmin("noScore") : `${stats.data.averageFirstScore}%`} />
              <Stat term={tAdmin("successRate")} value={stats.data.successRate === null ? tAdmin("noScore") : `${stats.data.successRate}%`} />
              <Stat term={tAdmin("aiCost")} value={money.format(stats.data.aiCostUsd)} />
            </dl>
            <h3 className="mt-6 text-sm font-medium">{tAdmin("weakCriteria")}</h3>
            {stats.data.weakCriteria.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{tAdmin("weakEmpty")}</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {stats.data.weakCriteria.map((criterion) => (
                  <li key={criterion.title}>
                    {criterion.title}
                    {" · "}
                    {criterion.failedCount}
                  </li>
                ))}
              </ul>
            )}
            <h3 className="mt-8 text-lg font-semibold">{tAdmin("scenarioStatsTitle")}</h3>
            {stats.data.scenarios.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{tAdmin("scenarioStatsEmpty")}</p>
            ) : (
              <ul className="mt-4 divide-y rounded-xl border bg-card">
                {[...stats.data.scenarios]
                  .sort((left, right) => right.attempts - left.attempts || left.title.localeCompare(right.title, "uk"))
                  .map((scenario) => (
                    <li key={scenario.id} className="p-4">
                      <Link to={`/admin/scenarios/${scenario.id}`} className="font-medium hover:underline">
                        {scenario.title}
                      </Link>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {tAdmin("studentAttempts", { count: scenario.attempts })}
                        {" · "}
                        {tAdmin("averageScore")}
                        {": "}
                        {scenario.averageScore === null ? tAdmin("noScore") : `${scenario.averageScore}%`}
                        {" · "}
                        {tAdmin("averageFirstScore")}
                        {": "}
                        {scenario.averageFirstScore === null ? tAdmin("noScore") : `${scenario.averageFirstScore}%`}
                        {" · "}
                        {tAdmin("successRate")}
                        {": "}
                        {scenario.successRate === null ? tAdmin("noScore") : `${scenario.successRate}%`}
                      </p>
                    </li>
                  ))}
              </ul>
            )}
            <StudentRoster
              students={stats.data.students}
              onDelete={async (id) => {
                await deleteStudent.mutateAsync(id);
              }}
              onRoleChange={async (id, role) => {
                await updateStudent.mutateAsync({ id, role });
              }}
              onAddReviews={async (id, count) => {
                await updateStudent.mutateAsync({ id, addReviews: count });
              }}
            />
          </>
        ) : null}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">{tAdmin("scenariosTitle")}</h2>
        {scenarios.isPending ? <p className="mt-3 text-sm text-muted-foreground">{tAdmin("scenariosLoading")}</p> : null}
        {scenarios.isError ? (
          <Alert variant="destructive" className="mt-3">
            <AlertDescription>
              {tAdmin("scenariosError")}{" "}
              {translateApiError(tErrors, scenarios.error instanceof ApiError ? scenarios.error.code : "INTERNAL_ERROR")}
            </AlertDescription>
          </Alert>
        ) : null}
        {scenarios.data && scenarios.data.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{tAdmin("scenariosEmpty")}</p>
        ) : null}
        {scenarios.data && scenarios.data.length > 0 ? (
          <ul className="mt-4 divide-y rounded-xl border bg-card">
            {scenarios.data.map((scenario) => (
              <li key={scenario.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{scenario.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {tCatalog(`taskType.${scenario.taskType}`)}
                    {" · "}
                    {tCatalog(`mode.${scenario.mode}`)}
                    {" · "}
                    {tAdmin(`status.${scenario.status}`)}
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link to={`/admin/scenarios/${scenario.id}`}>{tAdmin("edit")}</Link>
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </AuthLayout>
  );
}

function Stat({ term, value }: { term: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{term}</dt>
      <dd className="mt-1 text-2xl font-semibold">{value}</dd>
    </div>
  );
}
