import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import i18n from "i18next";
import { afterEach } from "vitest";
import "../i18n";

afterEach(() => {
  cleanup();
});

i18n.options.saveMissing = true;
i18n.options.missingKeyHandler = (_languages, namespace, key) => {
  throw new Error(`Missing i18n key: ${String(namespace)}:${key}`);
};
i18n.options.parseMissingKeyHandler = (key) => {
  throw new Error(`Missing i18n key: ${key}`);
};
