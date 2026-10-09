import { ERROR_CODE, loginSchema } from "@manual-trainer/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router";
import type { z } from "zod";
import { ApiError } from "@/api/client";
import { useLogin, useResendVerification } from "@/api/auth";
import { FullPageSpinner } from "@/components/FullPageSpinner";
import { GoogleSignIn } from "@/components/GoogleSignIn";
import { Logo } from "@/components/Logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { translateApiError } from "@/lib/translateError";

function destinationFrom(state: unknown): string {
  if (!state || typeof state !== "object" || !("from" in state)) {
    return "/";
  }
  const from = state.from;
  if (!from || typeof from !== "object" || !("pathname" in from)) {
    return "/";
  }
  const pathname = from.pathname;
  if (typeof pathname !== "string" || !pathname.startsWith("/") || pathname.startsWith("//")) {
    return "/";
  }
  return pathname;
}

export function LoginPage() {
  const { t } = useTranslation("auth");
  const { t: tErrors } = useTranslation("errors");
  const { currentUser, isError } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const login = useLogin();
  const resend = useResendVerification();
  const destination = destinationFrom(location.state);

  const form: UseFormReturn<
    z.input<typeof loginSchema>,
    unknown,
    z.output<typeof loginSchema>
  > = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  if (currentUser === undefined && !isError) {
    return <FullPageSpinner />;
  }

  if (currentUser) {
    return <Navigate to={destination} replace />;
  }

  const googleError = searchParams.get("error");
  const verified = searchParams.get("verified") === "1";
  const emailNotVerified = login.error instanceof ApiError && login.error.code === ERROR_CODE.EMAIL_NOT_VERIFIED;
  const apiMessage =
    googleError === "unverified"
      ? t("login.googleUnverified")
      : googleError === "verify"
        ? t("login.verifyError")
        : googleError
          ? t("login.googleError")
          : login.error instanceof ApiError
            ? translateApiError(tErrors, login.error.code)
            : login.error
              ? tErrors("NETWORK_ERROR")
              : null;

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-card-foreground shadow-sm">
        <Logo />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">{t("login.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("login.description")}</p>
        <Form {...form}>
          <form
            className="mt-6 space-y-4"
            noValidate
            onSubmit={(event) => {
              void form.handleSubmit((values) => {
                login.mutate(values, {
                  onSuccess: () => {
                    void navigate(destination, { replace: true });
                  },
                });
              })(event);
            }}
          >
            {verified && !apiMessage ? (
              <Alert>
                <AlertDescription>{t("login.verified")}</AlertDescription>
              </Alert>
            ) : null}
            {apiMessage ? (
              <Alert variant="destructive">
                <AlertDescription>{apiMessage}</AlertDescription>
              </Alert>
            ) : null}
            {emailNotVerified ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={resend.isPending}
                onClick={() => resend.mutate(form.getValues("email"))}
              >
                {resend.isPending ? t("login.resending") : t("login.resend")}
              </Button>
            ) : null}
            {resend.isSuccess ? (
              <Alert>
                <AlertDescription>{t("login.resendDone")}</AlertDescription>
              </Alert>
            ) : null}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("login.email")}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder={t("login.emailPlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("login.password")}</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
              {login.isPending ? t("login.submitting") : t("login.submit")}
            </Button>
          </form>
        </Form>
        <GoogleSignIn />
        <p className="mt-4 text-sm text-muted-foreground">
          {t("login.switchPrompt")}{" "}
          <Link to="/register" className="font-medium text-primary hover:underline">
            {t("login.switchAction")}
          </Link>
        </p>
      </div>
    </div>
  );
}
