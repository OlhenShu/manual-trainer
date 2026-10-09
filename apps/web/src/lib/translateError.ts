import { ERROR_CODE } from "@manual-trainer/shared";
import type { TFunction } from "i18next";

export function translateApiError(t: TFunction<"errors">, code: string): string {
  switch (code) {
    case ERROR_CODE.VALIDATION_ERROR:
      return t("VALIDATION_ERROR");
    case ERROR_CODE.EMAIL_TAKEN:
      return t("EMAIL_TAKEN");
    case ERROR_CODE.EMAIL_NOT_VERIFIED:
      return t("EMAIL_NOT_VERIFIED");
    case ERROR_CODE.EMAIL_DELIVERY_FAILED:
      return t("EMAIL_DELIVERY_FAILED");
    case ERROR_CODE.INVALID_CREDENTIALS:
      return t("INVALID_CREDENTIALS");
    case ERROR_CODE.UNAUTHORIZED:
      return t("UNAUTHORIZED");
    case ERROR_CODE.FORBIDDEN:
      return t("FORBIDDEN");
    case ERROR_CODE.NOT_FOUND:
      return t("NOT_FOUND");
    case ERROR_CODE.RATE_LIMITED:
      return t("RATE_LIMITED");
    case ERROR_CODE.INTERNAL_ERROR:
      return t("INTERNAL_ERROR");
    case ERROR_CODE.SLUG_TAKEN:
      return t("SLUG_TAKEN");
    case "NETWORK_ERROR":
      return t("NETWORK_ERROR");
    default:
      return t("INTERNAL_ERROR");
  }
}
