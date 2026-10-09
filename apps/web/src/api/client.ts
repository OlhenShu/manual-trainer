import { errorResponseSchema } from "@manual-trainer/shared";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function readError(response: Response): Promise<ApiError> {
  try {
    const body: unknown = await response.json();
    const parsed = errorResponseSchema.safeParse(body);
    if (parsed.success) {
      return new ApiError(response.status, parsed.data.error.code);
    }
  } catch {
    // Malformed body still becomes a generic client error.
  }
  return new ApiError(response.status, "INTERNAL_ERROR");
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR");
  }

  if (!response.ok) {
    throw await readError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
