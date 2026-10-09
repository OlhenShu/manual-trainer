import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { AuthLayout } from "@/components/AuthLayout";
import { FullPageSpinner } from "@/components/FullPageSpinner";
import { useAuth } from "@/context/AuthContext";

export function NotAuthorizedPage() {
  const { t } = useTranslation("auth");
  const { currentUser, isError } = useAuth();

  if (currentUser === undefined && !isError) {
    return <FullPageSpinner />;
  }

  const body = (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight">{t("notAuthorized.title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("notAuthorized.description")}</p>
      <Link to="/" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
        {t("notAuthorized.backHome")}
      </Link>
    </div>
  );

  if (currentUser) {
    return <AuthLayout>{body}</AuthLayout>;
  }

  return <main className="mx-auto max-w-lg px-4 py-16">{body}</main>;
}
