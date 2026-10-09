import {
  DIFFICULTY,
  SCENARIO_MODE,
  SCENARIO_STATUS,
  TASK_TYPE,
  VALIDATION_KEY,
  adminScenarioWriteSchema,
  difficultyValues,
  rubricCriterionSchema,
  scenarioModeValues,
  scenarioStatusSchema,
  taskTypeValues,
  type AdminScenarioWrite,
} from "@manual-trainer/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useFormContext, type UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";
import { z } from "zod";
import { ApiError } from "@/api/client";
import { useAdminScenario, useSaveScenario } from "@/api/admin";
import { AuthLayout } from "@/components/AuthLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { translateApiError } from "@/lib/translateError";

const requiredText = z
  .string()
  .refine((value) => value.trim().length > 0, { error: VALIDATION_KEY.FIELD_REQUIRED });

const formSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { error: VALIDATION_KEY.SLUG_INVALID }),
    title: requiredText,
    summary: requiredText,
    taskType: z.enum(taskTypeValues),
    mode: z.enum(scenarioModeValues),
    difficulty: z.enum(difficultyValues),
    status: scenarioStatusSchema,
    prompt: requiredText,
    passingThreshold: z.number({ error: VALIDATION_KEY.FIELD_REQUIRED }).int().min(1).max(100),
    referenceSolution: requiredText,
    criteria: z.array(rubricCriterionSchema).min(1),
    defectItems: z.array(z.object({ text: z.string() })),
  })
  .superRefine((value, ctx) => {
    const weight = value.criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
    if (weight !== 100) {
      ctx.addIssue({ code: "custom", message: VALIDATION_KEY.RUBRIC_WEIGHTS, path: ["criteria"] });
    }
    if (value.mode === SCENARIO_MODE.FIX && value.defectItems.every((item) => item.text.trim().length === 0)) {
      ctx.addIssue({ code: "custom", message: VALIDATION_KEY.DEFECTS_REQUIRED, path: ["defectItems"] });
    }
  });

type FormValues = z.output<typeof formSchema>;

const emptyValues: FormValues = {
  slug: "",
  title: "",
  summary: "",
  taskType: TASK_TYPE.TEST_CASE,
  mode: SCENARIO_MODE.CREATE,
  difficulty: DIFFICULTY.EASY,
  status: SCENARIO_STATUS.DRAFT,
  prompt: "",
  passingThreshold: 70,
  referenceSolution: "",
  criteria: [{ id: "main", title: "", description: "", weight: 100 }],
  defectItems: [{ text: "" }],
};

export function AdminScenarioPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const existing = useAdminScenario(isNew ? undefined : id);
  const { t } = useTranslation("admin");
  const { t: tErrors } = useTranslation("errors");

  if (!isNew && existing.isPending) {
    return (
      <AuthLayout wide>
        <p role="status">{t("scenariosLoading")}</p>
      </AuthLayout>
    );
  }

  if (!isNew && existing.isError) {
    return (
      <AuthLayout wide>
        <Alert variant="destructive">
          <AlertDescription>
            {translateApiError(tErrors, existing.error instanceof ApiError ? existing.error.code : "INTERNAL_ERROR")}
          </AlertDescription>
        </Alert>
      </AuthLayout>
    );
  }

  const initial: FormValues = existing.data
    ? {
        slug: existing.data.slug,
        title: existing.data.title,
        summary: existing.data.summary,
        taskType: existing.data.taskType,
        mode: existing.data.mode,
        difficulty: existing.data.difficulty,
        status: existing.data.status,
        prompt: existing.data.prompt,
        passingThreshold: existing.data.passingThreshold,
        referenceSolution: existing.data.referenceSolution,
        criteria: existing.data.rubric.criteria,
        defectItems:
          existing.data.embeddedDefects.length > 0
            ? existing.data.embeddedDefects.map((text) => ({ text }))
            : [{ text: "" }],
      }
    : emptyValues;

  return <ScenarioEditor scenarioId={isNew ? undefined : id} initial={initial} />;
}

function ScenarioEditor({ scenarioId, initial }: { scenarioId?: string; initial: FormValues }) {
  const { t } = useTranslation("admin");
  const { t: tCatalog } = useTranslation("catalog");
  const { t: tErrors } = useTranslation("errors");
  const navigate = useNavigate();
  const save = useSaveScenario(scenarioId);
  const form: UseFormReturn<FormValues> = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: initial.defectItems.length > 0 ? initial : { ...initial, defectItems: [{ text: "" }] },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const criteria = useFieldArray({ control: form.control, name: "criteria" });
  const defects = useFieldArray({ control: form.control, name: "defectItems" });
  const mode = form.watch("mode");

  function onSubmit(values: FormValues) {
    const payload: AdminScenarioWrite = adminScenarioWriteSchema.parse({
      slug: values.slug,
      title: values.title,
      summary: values.summary,
      taskType: values.taskType,
      mode: values.mode,
      difficulty: values.difficulty,
      status: values.status,
      prompt: values.prompt,
      passingThreshold: values.passingThreshold,
      referenceSolution: values.referenceSolution,
      rubric: { criteria: values.criteria },
      embeddedDefects:
        values.mode === SCENARIO_MODE.FIX ? values.defectItems.map((item) => item.text).filter((text) => text.trim()) : [],
    });
    save.mutate(payload, {
      onSuccess: (scenario) => {
        void navigate(`/admin/scenarios/${scenario.id}`, { replace: true });
      },
    });
  }

  return (
    <AuthLayout wide>
      <Link to="/admin" className="text-sm text-primary underline-offset-4 hover:underline">
        {t("back")}
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        {scenarioId ? t("formTitleEdit") : t("formTitleCreate")}
      </h1>
      <Form {...form}>
        <form className="mt-6 space-y-4" noValidate onSubmit={form.handleSubmit(onSubmit)}>
          {save.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {translateApiError(tErrors, save.error instanceof ApiError ? save.error.code : "INTERNAL_ERROR")}
              </AlertDescription>
            </Alert>
          ) : null}
          {save.isSuccess ? (
            <Alert>
              <AlertDescription>{t("saved")}</AlertDescription>
            </Alert>
          ) : null}
          <Text name="slug" label={t("slug")} />
          <Text name="title" label={t("title")} />
          <Area name="summary" label={t("summary")} />
          <Choice name="taskType" label={t("taskType")} options={taskTypeValues.map((value) => ({ value, label: tCatalog(`taskType.${value}`) }))} />
          <Choice name="mode" label={t("mode")} options={scenarioModeValues.map((value) => ({ value, label: tCatalog(`mode.${value}`) }))} />
          <Choice name="difficulty" label={t("difficulty")} options={difficultyValues.map((value) => ({ value, label: tCatalog(`difficulty.${value}`) }))} />
          <Choice name="status" label={t("statusLabel")} options={[{ value: "draft", label: t("status.draft") }, { value: "published", label: t("status.published") }]} />
          <NumberField name="passingThreshold" label={t("threshold")} />
          <Area name="prompt" label={t("prompt")} />
          <Area name="referenceSolution" label={t("reference")} />

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">{t("rubric")}</legend>
            {criteria.fields.map((criterion, index) => (
              <div key={criterion.id} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2">
                <Text name={`criteria.${index}.id`} label={t("criterionId")} />
                <Text name={`criteria.${index}.title`} label={t("criterionTitle")} />
                <Area name={`criteria.${index}.description`} label={t("criterionDescription")} />
                <NumberField name={`criteria.${index}.weight`} label={t("criterionWeight")} />
                <Button type="button" variant="outline" disabled={criteria.fields.length === 1} onClick={() => criteria.remove(index)}>
                  {t("removeCriterion")}
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => criteria.append({ id: "", title: "", description: "", weight: 0 })}>
              {t("addCriterion")}
            </Button>
            <FieldError name="criteria" />
          </fieldset>

          {mode === SCENARIO_MODE.FIX ? (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">{t("defects")}</legend>
              <p className="text-sm text-muted-foreground">{t("defectHint")}</p>
              {defects.fields.map((defect, index) => (
                <div key={defect.id} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Text name={`defectItems.${index}.text`} label={`${t("defects")} ${index + 1}`} />
                  </div>
                  <Button type="button" variant="outline" className="mt-7" disabled={defects.fields.length === 1} onClick={() => defects.remove(index)}>
                    {t("removeDefect")}
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={() => defects.append({ text: "" })}>
                {t("addDefect")}
              </Button>
              <FieldError name="defectItems" />
            </fieldset>
          ) : null}

          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? t("saving") : t("save")}
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}

function Text({ name, label }: { name: string; label: string }) {
  const form = useFormContext<FormValues>();
  return (
    <FormField
      control={form.control}
      name={name as "title"}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...field} value={typeof field.value === "string" ? field.value : ""} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function Area({ name, label }: { name: string; label: string }) {
  const form = useFormContext<FormValues>();
  return (
    <FormField
      control={form.control}
      name={name as "prompt"}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea {...field} value={typeof field.value === "string" ? field.value : ""} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function NumberField({ name, label }: { name: string; label: string }) {
  const form = useFormContext<FormValues>();
  return (
    <FormField
      control={form.control}
      name={name as "passingThreshold"}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              value={typeof field.value === "number" ? field.value : ""}
              onChange={(event) => field.onChange(event.target.value === "" ? Number.NaN : event.target.valueAsNumber)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function Choice({ name, label, options }: { name: string; label: string; options: { value: string; label: string }[] }) {
  const form = useFormContext<FormValues>();
  return (
    <FormField
      control={form.control}
      name={name as "status"}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Select {...field} value={String(field.value)}>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
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

function FieldError({ name }: { name: "criteria" | "defectItems" }) {
  const form = useFormContext<FormValues>();
  const { t } = useTranslation("errors");
  const message = form.formState.errors[name]?.message;
  if (!message || typeof message !== "string") return null;
  const text =
    message === VALIDATION_KEY.RUBRIC_WEIGHTS || message === VALIDATION_KEY.DEFECTS_REQUIRED
      ? t(message)
      : t("INTERNAL_ERROR");
  return <p className="text-sm text-destructive">{text}</p>;
}
