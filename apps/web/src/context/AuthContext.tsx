import type { PublicUser } from "@manual-trainer/shared";
import { createContext, useContext, type ReactNode } from "react";
import { useMe } from "@/api/auth";

export type AuthContextValue = {
  currentUser: PublicUser | null | undefined;
  isError: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthStateProvider({
  currentUser,
  isError = false,
  children,
}: {
  currentUser: PublicUser | null | undefined;
  isError?: boolean;
  children: ReactNode;
}) {
  return <AuthContext.Provider value={{ currentUser, isError }}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const me = useMe();
  const currentUser = me.isPending ? undefined : me.isSuccess ? me.data : undefined;
  return (
    <AuthStateProvider currentUser={currentUser} isError={me.isError}>
      {children}
    </AuthStateProvider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
