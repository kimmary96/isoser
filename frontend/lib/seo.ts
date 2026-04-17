export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://isoser.vercel.app";

export function getSiteUrl(path = "/"): string {
  return new URL(path, SITE_URL).toString();
}
