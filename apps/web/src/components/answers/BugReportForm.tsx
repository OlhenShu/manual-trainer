import {
  PRIORITY,
  SEVERITY,
  bugReportAnswerSchema,
  severityValues,
} from "@manual-trainer/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { z } from "zod";
import { AnswerShell, PriorityField } from "@/components/answers/AnswerShell";
import { TextItems } from "@/components/answers/TextItems";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Values = z.output<typeof bugReportAnswerSchema>;

export function BugReportForm({ scenarioId }: { scenarioId: string }) {
  const { t } = useTranslation("answers");
  const form: UseFormReturn<Values> = useForm({
    resolver: zodResolver(bugReportAnswerSchema),
    defaultValues: {
      taskType: "bug_report",
      summary: "",
      environment: "",
      stepsToReproduce: [{ text: "" }],
      actualResult: "",
      expectedResult: "",
      severity: SEVERITY.MAJOR,
      priority: PRIORITY.MEDIUM,
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  return (
    <AnswerShell form={form} scenarioId={scenarioId}>
      <FormField
        control={form.control}
        name="summary"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("bugReport.summary")}</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="environment"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("bugReport.environment")}</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <TextItems form={form} name="stepsToReproduce" label={t("bugReport.steps")} />
      <FormField
        control={form.control}
        name="actualResult"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("bugReport.actualResult")}</FormLabel>
            <FormControl>
              <Textarea {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="expectedResult"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("bugReport.expectedResult")}</FormLabel>
            <FormControl>
              <Textarea {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="severity"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("bugReport.severity")}</FormLabel>
            <FormControl>
              <Select {...field}>
                {severityValues.map((value) => (
                  <option key={value} value={value}>
                    {t(`severity.${value}`)}
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <PriorityField form={form} />
    </AnswerShell>
  );
}
