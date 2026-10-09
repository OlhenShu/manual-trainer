import { BrowserRouter, Route, Routes } from "react-router";
import { RouteBoundary } from "@/components/RouteErrorBoundary";
import { RoleGuard } from "@/components/RoleGuard";
import { AuthProvider } from "@/context/AuthContext";
import { AdminPage } from "@/pages/AdminPage";
import { AdminScenarioPage } from "@/pages/AdminScenarioPage";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { NotAuthorizedPage } from "@/pages/NotAuthorizedPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { ScenarioPage } from "@/pages/ScenarioPage";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <RouteBoundary>
                <LoginPage />
              </RouteBoundary>
            }
          />
          <Route
            path="/register"
            element={
              <RouteBoundary>
                <RegisterPage />
              </RouteBoundary>
            }
          />
          <Route
            path="/"
            element={
              <RouteBoundary>
                <RoleGuard requireAuth>
                  <HomePage />
                </RoleGuard>
              </RouteBoundary>
            }
          />
          <Route
            path="/scenarios/:id"
            element={
              <RouteBoundary>
                <RoleGuard requireAuth>
                  <ScenarioPage />
                </RoleGuard>
              </RouteBoundary>
            }
          />
          <Route
            path="/admin/scenarios/:id"
            element={
              <RouteBoundary>
                <RoleGuard requireAuth requireAdmin>
                  <AdminScenarioPage />
                </RoleGuard>
              </RouteBoundary>
            }
          />
          <Route
            path="/admin"
            element={
              <RouteBoundary>
                <RoleGuard requireAuth requireAdmin>
                  <AdminPage />
                </RoleGuard>
              </RouteBoundary>
            }
          />
          <Route
            path="/not-authorized"
            element={
              <RouteBoundary>
                <NotAuthorizedPage />
              </RouteBoundary>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
