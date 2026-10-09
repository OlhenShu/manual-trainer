import { render } from "@testing-library/react";
import { useTranslation } from "react-i18next";
import { describe, expect, it } from "vitest";

function MissingKeyProbe() {
  const { t } = useTranslation("common");
  return <span>{t("missing.key" as "appName")}</span>;
}

describe("i18n missing keys", () => {
  it("throws when a rendered translation key does not exist", () => {
    expect(() => render(<MissingKeyProbe />)).toThrow(/Missing i18n key/);
  });
});
