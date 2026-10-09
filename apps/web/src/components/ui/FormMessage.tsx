import { VALIDATION_KEY, type ValidationKey } from "@manual-trainer/shared";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useFormField } from "@/components/ui/form";

const validationKeys = new Set<string>(Object.values(VALIDATION_KEY));

function isValidationKey(value: string): value is ValidationKey {
  return validationKeys.has(value);
}

function FormMessage({ className, children, ...props }: ComponentProps<"p">) {
  const { error, formMessageId } = useFormField();
  const { t } = useTranslation("errors");
  const raw = error ? String(error.message ?? "") : "";

  if (!raw && !children) {
    return null;
  }

  const content = raw
    ? isValidationKey(raw)
      ? t(raw)
      : t("INTERNAL_ERROR")
    : children;

  return (
    <p
      data-slot="form-message"
      id={formMessageId}
      className={cn("text-sm text-destructive", className)}
      {...props}
    >
      {content}
    </p>
  );
}

export { FormMessage };
