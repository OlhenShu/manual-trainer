import { priorityValues } from "@manual-trainer/shared";
import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/api/client";
import { useCreateAttempt } from "@/api/attempts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/select";
import { translateApiError } from "@/lib/translateError";

export function AnswerShell<T extends { taskType: string }>({
  form,
  scenarioId,
  children,
}: {
  form: UseFormReturn<T>;
  scenarioId: string;
  children: ReactNode;
}) {
  const { t } = useTranslation("answers");
  const { t: tErrors } = useTranslation("errors");
  const create = useCreateAttempt(scenarioId);
  const apiMessage =
    create.error instanceof ApiError
      ? translateApiError(tErrors, create.error.code)
      : create.error
        ? tErrors("NETWORK_ERROR")
        : null;

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      <Form {...form}>
        <form
          className="mt-4 space-y-4"
          noValidate
          onSubmit={(event) => {
            void form.handleSubmit((values) => {
              create.mutate(values as never);
            })(event);
          }}
        >
          {apiMessage ? (
            <Alert variant="destructive">
              <AlertDescription>{apiMessage}</AlertDescription>
            </Alert>
          ) : null}
          {create.isSuccess ? (
            <Alert>
              <AlertDescription>{t("saved")}</AlertDescription>
            </Alert>
          ) : null}
          {children}
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
            {create.isPending ? t("submitting") : t("submit")}
          </Button>
        </form>
      </Form>
    </section>
  );
}

export function PriorityField<T extends { priority: string }>({ form }: { form: UseFormReturn<T> }) {
  const { t } = useTranslation("answers");
  return (
    <FormField
      control={form.control}
      name={"priority" as never}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t("testCase.priority")}</FormLabel>
          <FormControl>
            <Select {...field} value={String(field.value ?? "")}>
              {priorityValues.map((value) => (
                <option key={value} value={value}>
                  {t(`priority.${value}`)}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
