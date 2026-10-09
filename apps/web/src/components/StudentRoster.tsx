import type { AdminStats } from "@manual-trainer/shared";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type Student = AdminStats["students"][number];
type StudentFilter = "all" | "reviewed" | "idle" | "passed" | "notPassed";
type StudentSort = "attempts" | "email" | "average" | "success" | "passed";

const filters: StudentFilter[] = ["all", "reviewed", "idle", "passed", "notPassed"];

function matchesFilter(student: Student, filter: StudentFilter): boolean {
  if (filter === "reviewed") return student.attempts > 0;
  if (filter === "idle") return student.attempts === 0;
  if (filter === "passed") return student.passedScenarios > 0;
  if (filter === "notPassed") return student.attempts > 0 && student.passedScenarios === 0;
  return true;
}

function matchesQuery(student: Student, query: string): boolean {
  if (!query) return true;
  const haystack = [student.email, ...student.scenarios.map((scenario) => scenario.title)]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function compareNullableDesc(left: number | null, right: number | null): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return right - left;
}

function compareStudents(left: Student, right: Student, sort: StudentSort): number {
  const byEmail = left.email.localeCompare(right.email, "uk");
  if (sort === "email") return byEmail;
  if (sort === "average") return compareNullableDesc(left.averageScore, right.averageScore) || byEmail;
  if (sort === "success") return compareNullableDesc(left.successRate, right.successRate) || byEmail;
  if (sort === "passed") return right.passedScenarios - left.passedScenarios || byEmail;
  return right.attempts - left.attempts || byEmail;
}

export function StudentRoster({
  students,
  onDelete,
  onRoleChange,
  onAddReviews,
}: {
  students: Student[];
  onDelete: (id: string) => Promise<void>;
  onRoleChange: (id: string, role: "user" | "admin") => Promise<void>;
  onAddReviews: (id: string, count: number) => Promise<void>;
}) {
  const { t } = useTranslation("admin");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StudentFilter>("all");
  const [sort, setSort] = useState<StudentSort>("attempts");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      students
        .filter((student) => matchesFilter(student, filter) && matchesQuery(student, normalizedQuery))
        .sort((left, right) => compareStudents(left, right, sort)),
    [filter, normalizedQuery, sort, students],
  );
  const filterLabel: Record<StudentFilter, string> = {
    all: t("studentFilterAll"),
    reviewed: t("studentFilterReviewed"),
    idle: t("studentFilterIdle"),
    passed: t("studentFilterPassed"),
    notPassed: t("studentFilterNotPassed"),
  };

  return (
    <>
      <h3 className="mt-8 text-lg font-semibold">{t("studentsTitle")}</h3>
      {students.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t("studentsEmpty")}</p>
      ) : (
        <>
          <div className="mt-4 flex flex-col gap-3">
            <div className="max-w-md">
              <Label htmlFor="student-search">{t("studentSearch")}</Label>
              <Input
                id="student-search"
                type="search"
                className="mt-2"
                value={query}
                placeholder={t("studentSearchPlaceholder")}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div role="group" aria-label={t("studentFilter")} className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{t("studentFilter")}</span>
              {filters.map((item) => (
                <Button
                  key={item}
                  type="button"
                  variant={filter === item ? "default" : "outline"}
                  aria-pressed={filter === item}
                  onClick={() => setFilter(item)}
                >
                  {filterLabel[item]}
                </Button>
              ))}
            </div>
            <div className="max-w-xs">
              <Label htmlFor="student-sort">{t("studentSort")}</Label>
              <Select
                id="student-sort"
                className="mt-2"
                value={sort}
                onChange={(event) => setSort(event.target.value as StudentSort)}
              >
                <option value="attempts">{t("studentSortAttempts")}</option>
                <option value="email">{t("studentSortEmail")}</option>
                <option value="average">{t("studentSortAverage")}</option>
                <option value="success">{t("studentSortSuccess")}</option>
                <option value="passed">{t("studentSortPassed")}</option>
              </Select>
            </div>
          </div>
          {visible.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">{t("studentsNoMatch")}</p>
          ) : (
            <ul aria-label={t("studentsTitle")} className="mt-4 space-y-4">
              {visible.map((student) => (
                <li key={student.id} className="rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{student.email}</p>
                      {student.emailVerified ? null : (
                        <p className="mt-1 text-sm text-danger">{t("emailUnverified")}</p>
                      )}
                    </div>
                    {student.role === "user" ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={deletingId === student.id}
                        onClick={() => {
                          if (!window.confirm(t("deleteStudentConfirm", { email: student.email }))) return;
                          setDeletingId(student.id);
                          void onDelete(student.id).finally(() => setDeletingId(null));
                        }}
                      >
                        {t("deleteStudent")}
                      </Button>
                    ) : null}
                  </div>
                  <AccountControls student={student} onRoleChange={onRoleChange} onAddReviews={onAddReviews} />
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("studentAttempts", { count: student.attempts })}
                    {" · "}
                    {t("averageScore")}
                    {": "}
                    {student.averageScore === null ? t("noScore") : `${student.averageScore}%`}
                    {" · "}
                    {t("averageFirstScore")}
                    {": "}
                    {student.averageFirstScore === null ? t("noScore") : `${student.averageFirstScore}%`}
                    {" · "}
                    {t("successRate")}
                    {": "}
                    {student.successRate === null ? t("noScore") : `${student.successRate}%`}
                    {" · "}
                    {t("passedScenarios", { count: student.passedScenarios })}
                  </p>
                  {student.scenarios.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">{t("studentNoAttempts")}</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {student.scenarios.map((scenario) => (
                        <li key={scenario.scenarioId} className="text-sm">
                          <span className="font-medium">{scenario.title}</span>
                          {" · "}
                          <span className={scenario.passed ? "text-success" : "text-danger"}>
                            {scenario.passed ? t("passed") : t("notPassed")}
                          </span>
                          {" · "}
                          {t("firstScore", { score: scenario.firstScore })}
                          {" · "}
                          {t("bestScore", { score: scenario.bestScore })}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

function AccountControls({
  student,
  onRoleChange,
  onAddReviews,
}: {
  student: Student;
  onRoleChange: (id: string, role: "user" | "admin") => Promise<void>;
  onAddReviews: (id: string, count: number) => Promise<void>;
}) {
  const { t } = useTranslation("admin");
  const [count, setCount] = useState(1);
  const [pending, setPending] = useState(false);

  return (
    <div className="mt-3 flex flex-wrap items-end gap-3">
      <div className="w-44">
        <Label htmlFor={`role-${student.id}`}>{t("roleLabel")}</Label>
        <Select
          id={`role-${student.id}`}
          className="mt-2"
          value={student.role}
          disabled={pending}
          onChange={(event) => {
            const role = event.target.value === "admin" ? "admin" : "user";
            if (role === student.role) return;
            const label = role === "admin" ? t("roleAdmin") : t("roleUser");
            if (!window.confirm(t("roleConfirm", { email: student.email, role: label }))) {
              event.target.value = student.role;
              return;
            }
            setPending(true);
            void onRoleChange(student.id, role).finally(() => setPending(false));
          }}
        >
          <option value="user">{t("roleUser")}</option>
          <option value="admin">{t("roleAdmin")}</option>
        </Select>
      </div>
      {student.role === "user" ? (
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const amount = Math.min(100, Math.max(1, Math.floor(count) || 1));
            setPending(true);
            void onAddReviews(student.id, amount).finally(() => setPending(false));
          }}
        >
          <p className="pb-2 text-sm text-muted-foreground">{t("extraReviews", { count: student.reviewCredits })}</p>
          <div className="w-28">
            <Label htmlFor={`reviews-${student.id}`}>{t("addReviewsCount")}</Label>
            <Input
              id={`reviews-${student.id}`}
              className="mt-2"
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(event) => setCount(Number(event.target.value))}
            />
          </div>
          <Button type="submit" variant="outline" disabled={pending}>
            {t("addReviews")}
          </Button>
        </form>
      ) : (
        <p className="pb-2 text-sm text-muted-foreground">{t("adminUnlimited")}</p>
      )}
    </div>
  );
}
