import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LogoutButton } from "@/components/LogoutButton";
import { AuthStateProvider } from "@/context/AuthContext";
import { userFixture } from "@/test/fixtures";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LogoutButton", () => {
  it("calls logout and redirects to /login", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ message: "Logged out." }), { status: 200 })),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/"]}>
          <AuthStateProvider currentUser={userFixture}>
            <Routes>
              <Route path="/" element={<LogoutButton />} />
              <Route path="/login" element={<div>login-marker</div>} />
            </Routes>
          </AuthStateProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Вийти" }));
    expect(await screen.findByText("login-marker")).toBeInTheDocument();
  });
});
