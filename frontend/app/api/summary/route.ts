import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json({ error: "Invalid content type" }, { status: 415 });
    }

    const body = (await req.json()) as { prompt?: unknown };
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }
    if (prompt.length > 6000) {
      return NextResponse.json({ error: "Prompt is too long" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key missing" }, { status: 500 });
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
      return NextResponse.json(
        { error: "Summary generation failed" },
        { status: response.status >= 500 ? 502 : 400 }
      );
    }

    const data = await response.json();
    const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return NextResponse.json({ summary });
  } catch {
    return NextResponse.json({ error: "Summary generation failed" }, { status: 500 });
  }
}
