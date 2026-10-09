import { registerSchema } from "@manual-trainer/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router";
import type { z } from "zod";
import { useRegister, useResendVerification } from "@/api/auth";
import { ApiError } from "@/api/client";
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

export function RegisterPage() {
  const { t } = useTranslation("auth");
  const { t: tErrors } = useTranslation("errors");
  const { currentUser, isError } = useAuth();
  const register = useRegister();
  const resend = useResendVerification();
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const form: UseFormReturn<
    z.input<typeof registerSchema>,
    unknown,
    z.output<typeof registerSchema>
  > = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  if (currentUser === undefined && !isError) {
    return <FullPageSpinner />;
  }

  if (currentUser) {
    return <Navigate to="/" replace />;
  }

  const apiMessage =
    register.error instanceof ApiError
      ? translateApiError(tErrors, register.error.code)
      : register.error
        ? tErrors("NETWORK_ERROR")
        : null;

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-card-foreground shadow-sm">
        <Logo />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          {pendingEmail ? t("register.checkEmailTitle") : t("register.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {pendingEmail ? t("register.checkEmail", { email: pendingEmail }) : t("register.description")}
        </p>
        {pendingEmail ? (
          <div className="mt-6 space-y-3">
            {resend.isSuccess ? (
              <Alert>
                <AlertDescription>{t("login.resendDone")}</AlertDescription>
              </Alert>
            ) : null}
            {resend.error instanceof ApiError ? (
              <Alert variant="destructive">
                <AlertDescription>{translateApiError(tErrors, resend.error.code)}</AlertDescription>
              </Alert>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={resend.isPending}
              onClick={() => resend.mutate(pendingEmail)}
            >
              {resend.isPending ? t("login.resending") : t("login.resend")}
            </Button>
            <p className="text-sm text-muted-foreground">
              <Link to="/login" className="font-medium text-primary hover:underline">
                {t("register.switchAction")}
              </Link>
            </p>
          </div>
        ) : (
        <Form {...form}>
          <form
            className="mt-6 space-y-4"
            noValidate
            onSubmit={(event) => {
              void form.handleSubmit((values) => {
                register.mutate(values, {
                  onSuccess: (result) => {
                    setPendingEmail(result.email);
                  },
                });
              })(event);
            }}
          >
            {apiMessage ? (
              <Alert variant="destructive">
                <AlertDescription>{apiMessage}</AlertDescription>
              </Alert>
            ) : null}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("register.email")}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder={t("register.emailPlaceholder")}
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
                  <FormLabel>{t("register.password")}</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={register.isPending}>
              {register.isPending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
              {register.isPending ? t("register.submitting") : t("register.submit")}
            </Button>
          </form>
        </Form>
        )}
        {pendingEmail ? null : (
          <>
        <GoogleSignIn />
        <p className="mt-4 text-sm text-muted-foreground">
          {t("register.switchPrompt")}{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            {t("register.switchAction")}
          </Link>
        </p>
          </>
        )}
      </div>
    </div>
  );
}
