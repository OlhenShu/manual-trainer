import { PRIORITY, testCaseAnswerSchema, type TaskType } from "@manual-trainer/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { z } from "zod";
import { TextItems } from "@/components/answers/TextItems";
import { AnswerShell, PriorityField } from "@/components/answers/AnswerShell";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BugReportForm } from "@/components/answers/BugReportForm";
import { RequirementsAnalysisForm } from "@/components/answers/RequirementsAnalysisForm";
import { RequirementsCompositionForm } from "@/components/answers/RequirementsCompositionForm";

type TestCaseFormValues = z.output<typeof testCaseAnswerSchema>;

export function AnswerForm({ scenarioId, taskType }: { scenarioId: string; taskType: TaskType }) {
  switch (taskType) {
    case "bug_report":
      return <BugReportForm scenarioId={scenarioId} />;
    case "requirements_analysis":
      return <RequirementsAnalysisForm scenarioId={scenarioId} />;
    case "requirements_composition":
      return <RequirementsCompositionForm scenarioId={scenarioId} />;
    case "test_case":
      return <TestCaseForm scenarioId={scenarioId} />;
  }
}

export function TestCaseForm({ scenarioId }: { scenarioId: string }) {
  const { t } = useTranslation("answers");
  const form: UseFormReturn<TestCaseFormValues> = useForm({
    resolver: zodResolver(testCaseAnswerSchema),
    defaultValues: {
      taskType: "test_case",
      name: "",
      preconditions: "",
      steps: [{ text: "" }],
      expectedResult: "",
      priority: PRIORITY.MEDIUM,
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  return (
    <AnswerShell form={form} scenarioId={scenarioId}>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("testCase.name")}</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="preconditions"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("testCase.preconditions")}</FormLabel>
            <FormControl>
              <Textarea {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <TextItems form={form} name="steps" label={t("testCase.steps")} />
      <FormField
        control={form.control}
        name="expectedResult"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("testCase.expectedResult")}</FormLabel>
            <FormControl>
              <Textarea {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <PriorityField form={form} />
    </AnswerShell>
  );
}
