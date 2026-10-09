import {
  DIFFICULTY,
  SCENARIO_MODE,
  TASK_TYPE,
  type Difficulty,
  type ScenarioMode,
  type TaskType,
} from "@manual-trainer/shared";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export interface CatalogFilters {
  taskType?: TaskType;
  mode?: ScenarioMode;
  difficulty?: Difficulty;
}

function FilterGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (next: T | undefined) => void;
}) {
  const { t } = useTranslation("catalog");

  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium">{label}</span>
      <Button
        type="button"
        size="default"
        variant={value === undefined ? "default" : "outline"}
        aria-pressed={value === undefined}
        onClick={() => onChange(undefined)}
      >
        {t("filters.all")}
      </Button>
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={value === option.value ? "default" : "outline"}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

export function ScenarioFilters({
  value,
  onChange,
}: {
  value: CatalogFilters;
  onChange: (next: CatalogFilters) => void;
}) {
  const { t } = useTranslation("catalog");

  return (
    <div className="mt-6 flex flex-col gap-3">
      <FilterGroup
        label={t("filters.taskType")}
        value={value.taskType}
        onChange={(taskType) => onChange({ ...value, taskType })}
        options={[
          { value: TASK_TYPE.TEST_CASE, label: t("taskType.test_case") },
          { value: TASK_TYPE.BUG_REPORT, label: t("taskType.bug_report") },
          { value: TASK_TYPE.REQUIREMENTS_ANALYSIS, label: t("taskType.requirements_analysis") },
          {
            value: TASK_TYPE.REQUIREMENTS_COMPOSITION,
            label: t("taskType.requirements_composition"),
          },
        ]}
      />
      <FilterGroup
        label={t("filters.mode")}
        value={value.mode}
        onChange={(mode) => onChange({ ...value, mode })}
        options={[
          { value: SCENARIO_MODE.FIX, label: t("mode.fix") },
          { value: SCENARIO_MODE.CREATE, label: t("mode.create") },
        ]}
      />
      <FilterGroup
        label={t("filters.difficulty")}
        value={value.difficulty}
        onChange={(difficulty) => onChange({ ...value, difficulty })}
        options={[
          { value: DIFFICULTY.EASY, label: t("difficulty.easy") },
          { value: DIFFICULTY.MEDIUM, label: t("difficulty.medium") },
          { value: DIFFICULTY.HARD, label: t("difficulty.hard") },
        ]}
      />
    </div>
  );
}
