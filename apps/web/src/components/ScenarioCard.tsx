import type { Difficulty, ScenarioListItem, ScenarioMode, TaskType } from "@manual-trainer/shared";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

const difficultyClassName: Record<Difficulty, string> = {
  easy: "bg-success/10 text-success",
  medium: "bg-warning/20 text-warning-foreground",
  hard: "bg-danger/10 text-danger",
};

function Badge({ className, children }: { className?: string; children: string }) {
  return (
    <span className={cn("rounded-md bg-muted px-2 py-0.5 text-xs font-medium", className)}>
      {children}
    </span>
  );
}

export function ScenarioCard({ scenario }: { scenario: ScenarioListItem }) {
  const { t } = useTranslation("catalog");

  return (
    <Link
      to={`/scenarios/${scenario.id}`}
      className="flex flex-col rounded-xl border bg-card p-5 shadow-xs transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="flex flex-wrap gap-2">
        <Badge>{t(`taskType.${scenario.taskType as TaskType}`)}</Badge>
        <Badge>{t(`mode.${scenario.mode as ScenarioMode}`)}</Badge>
        <Badge className={difficultyClassName[scenario.difficulty]}>
          {t(`difficulty.${scenario.difficulty as Difficulty}`)}
        </Badge>
      </div>
      <h3 className="mt-3 text-lg font-semibold tracking-tight">{scenario.title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{scenario.summary}</p>
    </Link>
  );
}
