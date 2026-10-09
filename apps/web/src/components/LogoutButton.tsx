import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useLogout } from "@/api/auth";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const { t } = useTranslation("auth");
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={logout.isPending ? t("logout.pending") : t("logout.action")}
      disabled={logout.isPending}
      onClick={() => {
        logout.mutate(undefined, {
          onSuccess: () => {
            void navigate("/login", { replace: true });
          },
        });
      }}
    >
      <LogOut aria-hidden />
    </Button>
  );
}
