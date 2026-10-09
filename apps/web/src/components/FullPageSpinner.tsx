import { LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

export function FullPageSpinner() {
  const { t } = useTranslation("common");
  return (
    <div className="flex min-h-svh items-center justify-center bg-background" role="status">
      <LoaderCircle className="size-8 animate-spin text-primary" aria-hidden />
      <span className="sr-only">{t("loading")}</span>
    </div>
  );
}
