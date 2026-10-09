import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthStateProvider } from "@/context/AuthContext";
import { HomePage } from "@/pages/HomePage";
import { userFixture } from "@/test/fixtures";

const scenarios = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "checkout-broken-cases",
    title: "Оформлення замовлення: виправити тест-кейси",
    summary: "У наборі для кошика пропущено кроки.",
    taskType: "test_case",
    mode: "fix",
    difficulty: "easy",
    passingThreshold: 70,
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    slug: "cart-total-bug",
    title: "Сума кошика: написати баг-репорт",
    summary: "Знижка застосовується двічі.",
    taskType: "bug_report",
    mode: "create",
    difficulty: "medium",
    passingThreshold: 70,
  },
];

function fetchHome(input: RequestInfo | URL, progress: unknown = []) {
  const url = String(input);
  if (url.includes("/api/progress")) return Response.json(progress);
  return Response.json(scenarios);
}

function renderHome() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AuthStateProvider currentUser={userFixture}>{children}</AuthStateProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  return render(<HomePage />, { wrapper: Wrapper });
}

describe("HomePage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("displays a Ukrainian greeting and the published scenario catalog", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => fetchHome(input)));
    renderHome();

    expect(
      await screen.findByRole("heading", { name: "Вітаємо, user@example.com" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Оберіть наступне завдання" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Оформлення замовлення/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Сума кошика/ })).toBeInTheDocument();
  });

  it("filters the catalog by task type without another request", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => fetchHome(input));
    vi.stubGlobal("fetch", fetchMock);
    renderHome();

    expect(await screen.findByRole("link", { name: /Оформлення замовлення/ })).toBeInTheDocument();
    const taskTypes = screen.getByRole("group", { name: "Тип завдання" });
    await userEvent.click(within(taskTypes).getByRole("button", { name: "Баг-репорти" }));

    expect(screen.queryByRole("link", { name: /Оформлення замовлення/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Сума кошика/ })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows the current user's first and best scores", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        fetchHome(input, [
          {
            scenarioId: "11111111-1111-4111-8111-111111111111",
            title: "Оформлення замовлення: виправити тест-кейси",
            firstScore: 23,
            bestScore: 80,
            passed: true,
          },
        ]),
      ),
    );
    renderHome();

    expect(await screen.findByRole("heading", { name: "Ваш прогрес" })).toBeInTheDocument();
    const progress = await screen.findByRole("link", { name: /Перша спроба: 23%/ });
    expect(progress).toHaveTextContent("Найкращий бал: 80%");
    expect(progress).toHaveTextContent("Зараховано");
  });
});
