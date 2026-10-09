import {
  attemptListSchema,
  attemptSchema,
  type Answer,
  type Attempt,
} from "@manual-trainer/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";

export function attemptsQueryKey(scenarioId: string) {
  return ["attempts", scenarioId] as const;
}

export function useAttempts(scenarioId: string | undefined) {
  return useQuery({
    queryKey: scenarioId ? attemptsQueryKey(scenarioId) : ["attempts", "none"],
    enabled: Boolean(scenarioId),
    queryFn: async (): Promise<Attempt[]> => {
      return attemptListSchema.parse(
        await apiRequest<unknown>(`/api/scenarios/${scenarioId}/attempts`),
      );
    },
  });
}

export function useCreateAttempt(scenarioId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (answer: Answer): Promise<Attempt> => {
      return attemptSchema.parse(
        await apiRequest<unknown>(`/api/scenarios/${scenarioId}/attempts`, {
          method: "POST",
          body: JSON.stringify(answer),
        }),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: attemptsQueryKey(scenarioId) });
      await queryClient.invalidateQueries({ queryKey: ["scenarios", scenarioId] });
      await queryClient.invalidateQueries({ queryKey: ["progress"] });
    },
  });
}

export function useRetryReview(scenarioId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (attemptId: string): Promise<Attempt> => {
      return attemptSchema.parse(
        await apiRequest<unknown>(`/api/scenarios/${scenarioId}/attempts/${attemptId}/review`, {
          method: "POST",
        }),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: attemptsQueryKey(scenarioId) });
      await queryClient.invalidateQueries({ queryKey: ["scenarios", scenarioId] });
      await queryClient.invalidateQueries({ queryKey: ["progress"] });
    },
  });
}
