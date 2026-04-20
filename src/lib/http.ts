import { AppError, isAppError } from "./errors";

export function jsonOk<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

export function jsonError(error: AppError): Response {
  return Response.json(
    {
      error: {
        code: error.code,
        message: error.message,
      },
    },
    { status: error.status },
  );
}

export function normalizeError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof SyntaxError) {
    return new AppError(400, "INVALID_INPUT", "JSON の形式が不正です。");
  }

  if (error instanceof Error) {
    return new AppError(500, "INTERNAL_ERROR", error.message);
  }

  return new AppError(500, "INTERNAL_ERROR", "予期しないエラーが発生しました。");
}
