export const DEFAULT_PUBLIC_LANDING = "/landing-c";
export const DASHBOARD_RECOMMEND_CALENDAR = "/dashboard#recommend-calendar";
export const DASHBOARD_HOME = "/dashboard";
export const ONBOARDING_RESUME_IMPORT = "/onboarding";

export function resolveInternalPath(value: string | null | undefined, fallback = DEFAULT_PUBLIC_LANDING): string {
  if (!value) return fallback;
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

export function getLoginHref(redirectedFrom = DEFAULT_PUBLIC_LANDING): string {
  return `/login?redirectedFrom=${encodeURIComponent(resolveInternalPath(redirectedFrom))}`;
}

export function getGoogleAuthHref(next = DEFAULT_PUBLIC_LANDING): string {
  return `/api/auth/google?next=${encodeURIComponent(resolveInternalPath(next))}`;
}
