import { progressListSchema, type ProgressItem } from "@manual-trainer/shared";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";

export function useProgress() {
  return useQuery({
    queryKey: ["progress"],
    queryFn: async (): Promise<ProgressItem[]> =>
      progressListSchema.parse(await apiRequest<unknown>("/api/progress")),
  });
}
