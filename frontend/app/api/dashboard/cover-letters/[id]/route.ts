import { apiError, apiOk } from "@/lib/api/route-response";
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { supabase, user } = await getAuthenticatedClient();
    const { data, error } = await supabase
      .from("cover_letters")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return apiOk({ coverLetter: data ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "자기소개서를 불러오지 못했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
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
      return apiError("자기소개서 저장 요청이 올바르지 않습니다.", 400, "BAD_REQUEST");
    }

    const payload = {
      title,
      company_name: companyName,
      job_title: jobTitle,
      prompt_question: promptQuestion,
      content,
      qa_items: qaItems,
      tags,
    };
    const legacyPayload = {
      title,
      company_name: companyName,
      job_title: jobTitle,
      prompt_question: promptQuestion,
      content,
      tags,
    };

    let { data, error } = await supabase
      .from("cover_letters")
      .update(payload)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (isQaColumnMissingError(error)) {
      const retry = await supabase
        .from("cover_letters")
        .update(legacyPayload)
        .eq("id", id)
        .eq("user_id", user.id)
        .select("*")
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) {
      throw new Error(error?.message ?? "자기소개서 저장에 실패했습니다.");
    }

    return apiOk({ coverLetter: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "자기소개서 저장에 실패했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { supabase, user } = await getAuthenticatedClient();
    const { data, error } = await supabase
      .from("cover_letters")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id");

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      throw new Error("자기소개서 삭제 권한이 없습니다.");
    }

    return apiOk({ id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "자기소개서 삭제에 실패했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
