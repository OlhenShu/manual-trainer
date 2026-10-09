import { requirementsCompositionAnswerSchema } from "@manual-trainer/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { z } from "zod";
import { AnswerShell } from "@/components/answers/AnswerShell";
import { TextItems } from "@/components/answers/TextItems";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { FormMessage } from "@/components/ui/FormMessage";
import { Textarea } from "@/components/ui/textarea";

type Values = z.output<typeof requirementsCompositionAnswerSchema>;

export function RequirementsCompositionForm({ scenarioId }: { scenarioId: string }) {
  const { t } = useTranslation("answers");
  const form: UseFormReturn<Values> = useForm({
    resolver: zodResolver(requirementsCompositionAnswerSchema),
    defaultValues: {
      taskType: "requirements_composition",
      userStory: "",
      acceptanceCriteria: [{ text: "" }],
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  return (
    <AnswerShell form={form} scenarioId={scenarioId}>
      <FormField
        control={form.control}
        name="userStory"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("composition.userStory")}</FormLabel>
            <FormControl>
              <Textarea {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <TextItems form={form} name="acceptanceCriteria" label={t("composition.acceptanceCriteria")} />
    </AnswerShell>
  );
}
