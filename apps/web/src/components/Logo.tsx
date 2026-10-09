import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

export function Logo() {
  const { t } = useTranslation("common");
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-2 rounded-md font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Check className="size-4" strokeWidth={3} aria-hidden />
      </span>
      {t("appName")}
    </Link>
  );
}
