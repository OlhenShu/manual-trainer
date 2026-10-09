import {
  loginSchema,
  publicUserSchema,
  registerResultSchema,
  registerSchema,
  resendVerificationSchema,
  type PublicUser,
} from "@manual-trainer/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { apiRequest, ApiError } from "@/api/client";

export const meQueryKey = ["me"] as const;

export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    retry: false,
    queryFn: async (): Promise<PublicUser | null> => {
      let response: Response;
      try {
        response = await fetch("/api/auth/me", { credentials: "include" });
      } catch {
        throw new ApiError(0, "NETWORK_ERROR");
      }
      if (response.status === 401) {
        return null;
      }
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const code =
          body && typeof body === "object" && "error" in body
            ? String((body as { error?: { code?: string } }).error?.code ?? "INTERNAL_ERROR")
            : "INTERNAL_ERROR";
        throw new ApiError(response.status, code);
      }
      return publicUserSchema.parse(await response.json());
    },
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: z.output<typeof loginSchema>) => {
      const data = await apiRequest<unknown>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return publicUserSchema.parse(data);
    },
    onSuccess: (user) => {
      queryClient.setQueryData(meQueryKey, user);
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: async (input: z.output<typeof registerSchema>) => {
      const data = await apiRequest<unknown>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return registerResultSchema.parse(data);
    },
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: async (email: string) => {
      const data = await apiRequest<unknown>("/api/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      return resendVerificationSchema.parse(data);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiRequest<unknown>("/api/auth/logout", { method: "POST" });
    },
    onSuccess: () => {
      queryClient.setQueryData(meQueryKey, null);
    },
  });
}
