import { cleanup, render, screen } from "@testing-library/react";
import * as fc from "fast-check";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { RoleGuard } from "@/components/RoleGuard";
import { AuthStateProvider } from "@/context/AuthContext";
import { userFixture } from "@/test/fixtures";

const anyProtectedRoutePath = fc.constantFrom(
  "/",
  "/home",
  "/profile",
  "/settings",
  "/tasks",
  "/history",
  "/account",
);

const anyAdminRoutePath = fc.constantFrom(
  "/admin",
  "/admin/scenarios",
  "/admin/users",
  "/admin/stats",
);

afterEach(() => {
  cleanup();
});

function renderGuard(
  path: string,
  currentUser: typeof userFixture | null | undefined,
  options: { requireAdmin?: boolean } = {},
) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthStateProvider currentUser={currentUser}>
        <Routes>
          <Route path="/login" element={<div>login-marker</div>} />
          <Route path="/not-authorized" element={<div>not-authorized-marker</div>} />
          <Route
            path="*"
            element={
              <RoleGuard requireAuth requireAdmin={options.requireAdmin}>
                <div>protected</div>
              </RoleGuard>
            }
          />
        </Routes>
      </AuthStateProvider>
    </MemoryRouter>,
  );
}

describe("RoleGuard", () => {
  it("Feature: foundation-auth, Property 13: RoleGuard redirects unauthenticated users to /login", () => {
    fc.assert(
      fc.property(anyProtectedRoutePath, (path) => {
        const view = renderGuard(path, null);
        try {
          expect(screen.getByText("login-marker")).toBeInTheDocument();
          expect(screen.queryByText("protected")).not.toBeInTheDocument();
        } finally {
          view.unmount();
        }
      }),
      { numRuns: 100 },
    );
  });

  it("Feature: foundation-auth, Property 14: RoleGuard redirects role=user away from admin routes", () => {
    fc.assert(
      fc.property(anyAdminRoutePath, (path) => {
        const view = renderGuard(path, userFixture, { requireAdmin: true });
        try {
          expect(screen.getByText("not-authorized-marker")).toBeInTheDocument();
          expect(screen.queryByText("protected")).not.toBeInTheDocument();
        } finally {
          view.unmount();
        }
      }),
      { numRuns: 100 },
    );
  });

  it("renders a spinner while currentUser is undefined and does not redirect", () => {
    renderGuard("/secret", undefined);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("login-marker")).not.toBeInTheDocument();
    expect(screen.queryByText("protected")).not.toBeInTheDocument();
  });
});
