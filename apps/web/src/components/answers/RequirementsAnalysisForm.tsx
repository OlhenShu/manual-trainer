import { ISSUE_TYPE, issueTypeValues, requirementsAnalysisAnswerSchema } from "@manual-trainer/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, type UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { z } from "zod";
import { AnswerShell } from "@/components/answers/AnswerShell";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Values = z.output<typeof requirementsAnalysisAnswerSchema>;

export function RequirementsAnalysisForm({ scenarioId }: { scenarioId: string }) {
  const { t } = useTranslation("answers");
  const form: UseFormReturn<Values> = useForm({
    resolver: zodResolver(requirementsAnalysisAnswerSchema),
    defaultValues: {
      taskType: "requirements_analysis",
      issues: [{ issueType: ISSUE_TYPE.CONTRADICTION, fragment: "", description: "" }],
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const issues = useFieldArray({ control: form.control, name: "issues" });

  return (
    <AnswerShell form={form} scenarioId={scenarioId}>
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">{t("analysis.issues")}</legend>
        {issues.fields.map((item, index) => (
          <div key={item.id} className="space-y-3 rounded-xl border bg-card p-4">
            <FormField
              control={form.control}
              name={`issues.${index}.issueType`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("analysis.issueType")}</FormLabel>
                  <FormControl>
                    <Select {...field}>
                      {issueTypeValues.map((value) => (
                        <option key={value} value={value}>
                          {t(`issueType.${value}`)}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`issues.${index}.fragment`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("analysis.fragment")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`issues.${index}.description`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("analysis.description")}</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="button"
              variant="outline"
              disabled={issues.fields.length === 1}
              onClick={() => issues.remove(index)}
            >
              {t("removeItem")}
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            issues.append({ issueType: ISSUE_TYPE.GAP, fragment: "", description: "" })
          }
        >
          {t("analysis.add")}
        </Button>
      </fieldset>
    </AnswerShell>
  );
}
