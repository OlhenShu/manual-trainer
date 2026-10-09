import { ROLE } from "@manual-trainer/shared";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation } from "react-router";
import { FullPageSpinner } from "@/components/FullPageSpinner";
import { useAuth } from "@/context/AuthContext";

export function RoleGuard({
  requireAuth = false,
  requireAdmin = false,
  children,
}: {
  requireAuth?: boolean;
  requireAdmin?: boolean;
  children: ReactNode;
}) {
  const { currentUser, isError } = useAuth();
  const location = useLocation();
  const { t } = useTranslation("common");

  if (currentUser === undefined) {
    if (isError) {
      return (
        <div
          role="alert"
          className="flex min-h-svh items-center justify-center bg-background px-4 text-center"
        >
          <p>{t("sessionError")}</p>
        </div>
      );
    }
    return <FullPageSpinner />;
  }

  if (requireAuth && currentUser === null) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requireAuth && requireAdmin && currentUser && currentUser.role !== ROLE.ADMIN) {
    return <Navigate to="/not-authorized" replace />;
  }

  return children;
}
