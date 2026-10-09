import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthStateProvider } from "@/context/AuthContext";
import { ScenarioPage } from "@/pages/ScenarioPage";
import { userFixture } from "@/test/fixtures";

const scenario = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "checkout-broken-cases",
  title: "Оформлення замовлення: виправити тест-кейси",
  summary: "У наборі для кошика пропущено кроки.",
  taskType: "test_case",
  mode: "fix",
  difficulty: "easy",
  passingThreshold: 70,
  prompt: "Знайдіть дефекти формулювання і виправте кейс.",
  referenceSolution: null,
};

function renderScenario() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthStateProvider currentUser={userFixture}>{children}</AuthStateProvider>
      </QueryClientProvider>
    );
  }
  return render(
    <MemoryRouter initialEntries={[`/scenarios/${scenario.id}`]}>
      <Routes>
        <Route path="/scenarios/:id" element={<ScenarioPage />} />
      </Routes>
    </MemoryRouter>,
    { wrapper: Wrapper },
  );
}

describe("ScenarioPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the Ukrainian task prompt and an answer form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/attempts")) {
          return Response.json([]);
        }
        return Response.json(scenario);
      }),
    );
    renderScenario();

    expect(await screen.findByRole("heading", { name: scenario.title })).toBeInTheDocument();
    expect(screen.getByText(scenario.prompt)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "До списку завдань" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("heading", { name: "Ваша відповідь" })).toBeInTheDocument();
    expect(await screen.findByText("Ви ще не надсилали відповідь на цей сценарій.")).toBeInTheDocument();
  });

  it("shows a Ukrainian validation message when the test-case name is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/attempts")) {
          return Response.json([]);
        }
        return Response.json(scenario);
      }),
    );
    renderScenario();
    expect(await screen.findByRole("button", { name: "Надіслати відповідь" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Надіслати відповідь" }));
    expect(await screen.findAllByText("Заповніть це поле.")).not.toHaveLength(0);
  });
});
