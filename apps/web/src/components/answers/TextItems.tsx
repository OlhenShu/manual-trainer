import type { FieldArrayPath, FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { useFieldArray } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/input";

export function TextItems<T extends FieldValues>({
  form,
  name,
  label,
}: {
  form: UseFormReturn<T, unknown, T>;
  name: FieldArrayPath<T>;
  label: string;
}) {
  const { t } = useTranslation("answers");
  const items = useFieldArray({ control: form.control, name });

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">{label}</legend>
      {items.fields.map((item, index) => (
        <FormField
          key={item.id}
          control={form.control}
          name={`${name}.${index}.text` as FieldPath<T>}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">
                {label} {index + 1}
              </FormLabel>
              <div className="flex items-start gap-2">
                <FormControl>
                  <Input {...field} value={typeof field.value === "string" ? field.value : ""} />
                </FormControl>
                <Button
                  type="button"
                  variant="outline"
                  disabled={items.fields.length === 1}
                  aria-label={t("removeItem")}
                  onClick={() => items.remove(index)}
                >
                  {t("removeItem")}
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      ))}
      <Button type="button" variant="outline" onClick={() => items.append({ text: "" } as never)}>
        {t("addItem")}
      </Button>
    </fieldset>
  );
}
