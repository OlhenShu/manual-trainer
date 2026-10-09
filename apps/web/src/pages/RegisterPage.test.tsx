import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { AuthStateProvider } from "@/context/AuthContext";
import { RegisterPage } from "@/pages/RegisterPage";

function renderRegister() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/register"]}>
        <AuthStateProvider currentUser={null}>
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
          </Routes>
        </AuthStateProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe("RegisterPage", () => {
  it("shows a Ukrainian validation error for a password shorter than 8 characters", async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.type(screen.getByLabelText("Електронна пошта"), "user@example.com");
    await user.type(screen.getByLabelText("Пароль"), "short");
    await user.click(screen.getByRole("button", { name: "Створити обліковий запис" }));
    expect(screen.getByText("Пароль має містити щонайменше 8 символів.")).toBeInTheDocument();
    expect(screen.queryByText("PASSWORD_TOO_SHORT")).not.toBeInTheDocument();
  });

  it("shows a Ukrainian validation error for a password longer than 72 UTF-8 bytes", async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.type(screen.getByLabelText("Електронна пошта"), "user@example.com");
    await user.click(screen.getByLabelText("Пароль"));
    await user.paste("а".repeat(37));
    await user.click(screen.getByRole("button", { name: "Створити обліковий запис" }));
    expect(
      screen.getByText("Пароль задовгий. Скоротіть його і спробуйте ще раз."),
    ).toBeInTheDocument();
    expect(screen.queryByText("PASSWORD_TOO_LONG")).not.toBeInTheDocument();
  });
});
