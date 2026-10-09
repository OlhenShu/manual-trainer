import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { FullPageSpinner } from "@/components/FullPageSpinner";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { useAuth } from "@/context/AuthContext";
import { ROLE } from "@manual-trainer/shared";

export function AuthLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { t } = useTranslation("common");
  const { currentUser, isError } = useAuth();

  if (currentUser === undefined && !isError) {
    return <FullPageSpinner />;
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <Logo />
          <nav className="flex items-center gap-3 text-sm">
            <Link
              to="/"
              className="rounded-md px-2 py-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {t("nav.home")}
            </Link>
            {currentUser?.role === ROLE.ADMIN ? (
              <Link
                to="/admin"
                className="rounded-md px-2 py-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {t("nav.admin")}
              </Link>
            ) : null}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {currentUser ? (
              <span className="max-w-48 truncate text-sm text-muted-foreground">
                {currentUser.email}
              </span>
            ) : null}
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className={wide ? "mx-auto w-full max-w-5xl px-4 py-8" : "mx-auto w-full max-w-3xl px-4 py-8"}>{children}</main>
    </div>
  );
}
