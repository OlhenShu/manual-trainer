import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthStateProvider } from "@/context/AuthContext";
import { LoginPage } from "@/pages/LoginPage";
import { userFixture } from "@/test/fixtures";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderLogin(options: {
  currentUser?: typeof userFixture | null;
  initialState?: unknown;
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const entry =
    options.initialState === undefined
      ? "/login"
      : { pathname: "/login", state: options.initialState };
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <AuthStateProvider currentUser={options.currentUser ?? null}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<div>home-marker</div>} />
            <Route path="/admin" element={<div>admin-marker</div>} />
          </Routes>
        </AuthStateProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LoginPage", () => {
  it("shows a Ukrainian validation error next to an invalid email", async () => {
    const user = userEvent.setup();
    renderLogin({});
    await user.type(screen.getByLabelText("Електронна пошта"), "not-an-email");
    await user.type(screen.getByLabelText("Пароль"), "password1");
    await user.click(screen.getByRole("button", { name: "Увійти" }));
    expect(screen.getByText("Введіть коректну електронну пошту.")).toBeInTheDocument();
    expect(screen.queryByText("EMAIL_INVALID")).not.toBeInTheDocument();
  });

  it("redirects an authenticated user to /", () => {
    renderLogin({ currentUser: userFixture });
    expect(screen.getByText("home-marker")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Увійти" })).not.toBeInTheDocument();
  });

  it("preserves location.state.from and returns there after login", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(userFixture)),
    );
    renderLogin({ initialState: { from: { pathname: "/admin" } } });
    await user.type(screen.getByLabelText("Електронна пошта"), "user@example.com");
    await user.type(screen.getByLabelText("Пароль"), "password1");
    await user.click(screen.getByRole("button", { name: "Увійти" }));
    expect(await screen.findByText("admin-marker")).toBeInTheDocument();
    expect(screen.queryByText("Invalid credentials.")).not.toBeInTheDocument();
  });

  it("shows a Ukrainian API error and hides the raw message", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          jsonResponse(
            { error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials." } },
            401,
          ),
      ),
    );
    renderLogin({});
    await user.type(screen.getByLabelText("Електронна пошта"), "user@example.com");
    await user.type(screen.getByLabelText("Пароль"), "password1");
    await user.click(screen.getByRole("button", { name: "Увійти" }));
    expect(
      await screen.findByText("Електронна пошта або пароль неправильні."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Invalid credentials.")).not.toBeInTheDocument();
  });
});
