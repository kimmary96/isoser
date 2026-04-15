import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:8000";

function buildBackendUrl(pathname: string): string {
  const base = BACKEND_URL.endsWith("/") ? BACKEND_URL.slice(0, -1) : BACKEND_URL;
  return `${base}${pathname}`;
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const response = await fetch(buildBackendUrl("/slack/interactivity/cowork-review"), {
    method: "POST",
    headers: {
      "content-type": request.headers.get("content-type") || "application/x-www-form-urlencoded",
      "x-slack-request-timestamp": request.headers.get("x-slack-request-timestamp") || "",
      "x-slack-signature": request.headers.get("x-slack-signature") || "",
    },
    body,
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") || "application/json; charset=utf-8";
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: {
      "content-type": contentType,
    },
  });
}
