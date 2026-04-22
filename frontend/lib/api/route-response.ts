import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR";

export type ApiErrorResponse = {
  error: string;
  code: ApiErrorCode;
};

export function apiError(error: string, status = 400, code: ApiErrorCode = "BAD_REQUEST") {
  return NextResponse.json<ApiErrorResponse>({ error, code }, { status });
}

export function apiOk<T>(payload: T, status = 200) {
  return NextResponse.json(payload, { status });
}

export function apiRateLimited(error: string, retryAfterSeconds: number) {
  return NextResponse.json<ApiErrorResponse>(
    { error, code: "RATE_LIMITED" },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    }
  );
}
