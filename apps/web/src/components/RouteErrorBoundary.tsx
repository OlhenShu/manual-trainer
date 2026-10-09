import { Component, type ReactNode } from "react";
import { useLocation } from "react-router";
import i18n from "@/i18n";

type BoundaryState = {
  error: Error | null;
};

class RouteErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="mx-auto flex min-h-svh max-w-lg flex-col items-center justify-center px-4 text-center"
        >
          <h1 className="text-xl font-semibold">{i18n.t("errorBoundary.title")}</h1>
          <p className="mt-2 text-muted-foreground">{i18n.t("errorBoundary.message")}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export function RouteBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <RouteErrorBoundary key={location.pathname}>{children}</RouteErrorBoundary>;
}
