import {
  scenarioDetailSchema,
  scenarioListSchema,
  type ScenarioDetail,
  type ScenarioListItem,
} from "@manual-trainer/shared";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";

export function useScenarios() {
  return useQuery({
    queryKey: ["scenarios"],
    queryFn: async (): Promise<ScenarioListItem[]> => {
      return scenarioListSchema.parse(await apiRequest<unknown>("/api/scenarios"));
    },
  });
}

export function useScenario(id: string | undefined) {
  return useQuery({
    queryKey: ["scenarios", id],
    enabled: Boolean(id),
    queryFn: async (): Promise<ScenarioDetail> => {
      return scenarioDetailSchema.parse(await apiRequest<unknown>(`/api/scenarios/${id}`));
    },
  });
}
