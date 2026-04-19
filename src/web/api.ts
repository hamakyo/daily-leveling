export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = response.statusText;
    let code = "INTERNAL_ERROR";

    try {
      const payload = (await response.json()) as {
        error?: {
          code?: string;
          message?: string;
        };
      };
      code = payload.error?.code || code;
      message = payload.error?.message || message;
    } catch {
      // Ignore JSON parse failures and keep the transport error.
    }

    throw new ApiError(response.status, code, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
