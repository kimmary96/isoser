import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

function isQaColumnMissingError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42703") return true;
  return (error.message || "").toLowerCase().includes("qa_items");
}

async function getAuthenticatedClient() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("로그인이 필요합니다.");
  }

  return { supabase, user };
}

export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    const { data, error } = await supabase
      .from("cover_letters")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);
    return NextResponse.json({ coverLetters: data ?? [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "자기소개서 목록을 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    const body = (await request.json()) as {
      title?: string;
      company_name?: string | null;
      job_title?: string | null;
      prompt_question?: string;
      content?: string;
      qa_items?: Array<{ question?: string; answer?: string }>;
      tags?: string[];
    };

    const title = body.title?.trim();
    const companyName = body.company_name?.trim() || null;
    const jobTitle = body.job_title?.trim() || null;
    const promptQuestion = body.prompt_question?.trim();
    const content = body.content?.trim();
    const qaItems = Array.isArray(body.qa_items)
      ? body.qa_items
          .map((item) => ({
            question: String(item.question ?? "").trim(),
            answer: String(item.answer ?? "").trim(),
          }))
          .filter((item) => item.question || item.answer)
      : [];
    const tags = Array.isArray(body.tags)
      ? body.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : [];

    if (!title || !companyName || !jobTitle || !promptQuestion || !content || qaItems.length === 0) {
      return NextResponse.json({ error: "자기소개서 저장 요청이 올바르지 않습니다." }, { status: 400 });
    }

    const payload = {
      user_id: user.id,
      title,
      company_name: companyName,
      job_title: jobTitle,
      prompt_question: promptQuestion,
      content,
      qa_items: qaItems,
      tags,
    };
    const legacyPayload = {
      user_id: user.id,
      title,
      company_name: companyName,
      job_title: jobTitle,
      prompt_question: promptQuestion,
      content,
      tags,
    };

    let { data, error } = await supabase
      .from("cover_letters")
      .insert(payload)
      .select("*")
      .single();

    if (isQaColumnMissingError(error)) {
      const retry = await supabase
        .from("cover_letters")
        .insert(legacyPayload)
        .select("*")
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) {
      throw new Error(error?.message ?? "자기소개서 저장에 실패했습니다.");
    }

    return NextResponse.json({ coverLetter: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "자기소개서 저장에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
