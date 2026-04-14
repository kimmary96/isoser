import { NextRequest, NextResponse } from "next/server";

import { apiError, apiOk } from "@/lib/api/route-response";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return apiError("Invalid content type", 415, "BAD_REQUEST");
    }

    const body = (await req.json()) as { prompt?: unknown };
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return apiError("Prompt is required", 400, "BAD_REQUEST");
    }
    if (prompt.length > 6000) {
      return apiError("Prompt is too long", 400, "BAD_REQUEST");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return apiError("API key missing", 500, "INTERNAL_ERROR");
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) {
      return apiError(
        "Summary generation failed",
        response.status >= 500 ? 502 : 400,
        response.status >= 500 ? "UPSTREAM_ERROR" : "BAD_REQUEST"
      );
    }

    const data = await response.json();
    const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return apiOk({ summary });
  } catch {
    return apiError("Summary generation failed", 500, "INTERNAL_ERROR");
  }
}
