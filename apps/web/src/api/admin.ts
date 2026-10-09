import {
  adminScenarioListSchema,
  adminScenarioSchema,
  adminStatsSchema,
  type AdminScenario,
  type AdminScenarioWrite,
  type AdminStats,
} from "@manual-trainer/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";

export function useAdminScenarios() {
  return useQuery({
    queryKey: ["admin", "scenarios"],
    queryFn: async (): Promise<AdminScenario[]> =>
      adminScenarioListSchema.parse(await apiRequest<unknown>("/api/admin/scenarios")),
  });
}

export function useAdminScenario(id: string | undefined) {
  return useQuery({
    queryKey: ["admin", "scenarios", id],
    enabled: Boolean(id),
    queryFn: async (): Promise<AdminScenario> =>
      adminScenarioSchema.parse(await apiRequest<unknown>(`/api/admin/scenarios/${id}`)),
  });
}

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async (): Promise<AdminStats> =>
      adminStatsSchema.parse(await apiRequest<unknown>("/api/admin/stats")),
  });
}

export function useDeleteStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest<unknown>(`/api/admin/users/${id}`, { method: "DELETE" });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; role?: "user" | "admin"; addReviews?: number }) => {
      const { id, ...body } = input;
      await apiRequest<unknown>(`/api/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });
}

export function useSaveScenario(id: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminScenarioWrite): Promise<AdminScenario> => {
      const path = id ? `/api/admin/scenarios/${id}` : "/api/admin/scenarios";
      return adminScenarioSchema.parse(
        await apiRequest<unknown>(path, {
          method: id ? "PATCH" : "POST",
          body: JSON.stringify(input),
        }),
      );
    },
    onSuccess: async (scenario) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "scenarios"] });
      await queryClient.invalidateQueries({ queryKey: ["scenarios"] });
      queryClient.setQueryData(["admin", "scenarios", scenario.id], scenario);
    },
  });
}
