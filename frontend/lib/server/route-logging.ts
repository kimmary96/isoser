type RouteLogContext = {
  route: string;
  method: string;
  category:
    | "auth"
    | "rate-limit"
    | "validation"
    | "upload"
    | "profile"
    | "match"
    | "coach"
    | "summary"
    | "compare"
    | "unknown";
  userId?: string | null;
  status?: number;
  code?: string;
  note?: string;
};

function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim().slice(0, 300);
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim().slice(0, 300);
  }

  return "unknown_error";
}

export function logRouteError(context: RouteLogContext, error: unknown): void {
  const payload = {
    level: "error",
    source: "frontend-bff",
    route: context.route,
    method: context.method,
    category: context.category,
    userId: context.userId ?? null,
    status: context.status ?? null,
    code: context.code ?? null,
    note: context.note ?? null,
    message: sanitizeErrorMessage(error),
    timestamp: new Date().toISOString(),
  };

  console.error(JSON.stringify(payload));
}
