import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function GoogleSignIn() {
  const { t } = useTranslation("auth");

  return (
    <div className="mt-4 space-y-4">
      <p className="text-center text-sm text-muted-foreground">{t("login.or")}</p>
      <Button asChild variant="outline" className="w-full">
        <a href="/api/auth/google">{t("login.google")}</a>
      </Button>
    </div>
  );
}
