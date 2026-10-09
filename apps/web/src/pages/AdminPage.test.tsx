import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthStateProvider } from "@/context/AuthContext";
import { AdminPage } from "@/pages/AdminPage";
import { adminFixture } from "@/test/fixtures";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AdminPage", () => {
  it("calls GET /api/admin/ping on mount and displays the response", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/api/admin/ping")) {
        return new Response(JSON.stringify({ message: "pong" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "missing" } }), {
        status: 404,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AuthStateProvider currentUser={adminFixture}>
            <AdminPage />
          </AuthStateProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Сервер відповів: pong")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ping",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("shows a student's first score, best score, and whether the scenario passed", async () => {
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/admin/ping")) {
        return new Response(JSON.stringify({ message: "pong" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.endsWith("/api/admin/stats")) {
        return new Response(
          JSON.stringify({
            activeUsers: 1,
            attempts: 2,
            averageScore: 52,
            averageFirstScore: 23,
            successRate: 50,
            aiCostUsd: 0,
            scenarios: [
              {
                id: "22222222-2222-4222-8222-222222222222",
                title: "Оформлення замовлення",
                attempts: 2,
                averageScore: 52,
                averageFirstScore: 23,
                successRate: 50,
              },
            ],
            weakCriteria: [],
            students: [
              {
                id: "11111111-1111-4111-8111-111111111111",
                email: "student@test.example",
                attempts: 2,
                averageScore: 52,
                averageFirstScore: 23,
                successRate: 50,
                passedScenarios: 1,
                emailVerified: true,
                role: "user",
                reviewCredits: 0,
                scenarios: [
                  {
                    scenarioId: "22222222-2222-4222-8222-222222222222",
                    title: "Оформлення",
                    attempts: 2,
                    firstScore: 23,
                    bestScore: 80,
                    passed: true,
                  },
                ],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AuthStateProvider currentUser={adminFixture}>
            <AdminPage />
          </AuthStateProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("heading", { name: "По сценаріях" })).toBeInTheDocument();
    const scenarioStats = screen.getByRole("link", { name: "Оформлення замовлення" }).closest("li");
    expect(scenarioStats).toHaveTextContent("Спроб: 2");
    expect(scenarioStats).toHaveTextContent("Середній бал: 52%");
    expect(scenarioStats).toHaveTextContent("Середній перший бал: 23%");
    expect(scenarioStats).toHaveTextContent("Частка зарахованих: 50%");
    expect(await screen.findByRole("heading", { name: "Студенти" })).toBeInTheDocument();
    expect(screen.getByText("student@test.example")).toBeInTheDocument();
    expect(screen.getByText("student@test.example").closest("li")).toHaveTextContent("Спроб: 2");
    expect(screen.getByText("Оформлення")).toBeInTheDocument();
    expect(screen.getByText("Зараховано")).toBeInTheDocument();
    expect(screen.getByText("Оформлення").closest("li")).toHaveTextContent("Перша: 23%");
    expect(screen.getByText("Оформлення").closest("li")).toHaveTextContent("Найкраща: 80%");
  });
});
