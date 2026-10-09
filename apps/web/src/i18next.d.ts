import "i18next";
import type admin from "./locales/uk/admin.json";
import type answers from "./locales/uk/answers.json";
import type auth from "./locales/uk/auth.json";
import type catalog from "./locales/uk/catalog.json";
import type common from "./locales/uk/common.json";
import type errors from "./locales/uk/errors.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: {
      common: typeof common;
      auth: typeof auth;
      errors: typeof errors;
      catalog: typeof catalog;
      answers: typeof answers;
      admin: typeof admin;
    };
  }
}
