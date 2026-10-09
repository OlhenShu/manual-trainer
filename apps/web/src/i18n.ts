import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import admin from "./locales/uk/admin.json";
import answers from "./locales/uk/answers.json";
import auth from "./locales/uk/auth.json";
import catalog from "./locales/uk/catalog.json";
import common from "./locales/uk/common.json";
import errors from "./locales/uk/errors.json";

export const defaultNS = "common";

export const resources = {
  uk: {
    common,
    auth,
    errors,
    catalog,
    answers,
    admin,
  },
} as const;

void i18n.use(initReactI18next).init({
  lng: "uk",
  fallbackLng: "uk",
  ns: ["common", "auth", "errors", "catalog", "answers", "admin"],
  defaultNS,
  resources,
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
