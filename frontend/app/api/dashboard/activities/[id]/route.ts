import { NextResponse } from "next/server";

import { apiError, apiOk } from "@/lib/api/route-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
      .from("activities")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return apiOk({ activity: data ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "활동을 불러오지 못했습니다.";
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
    const body = (await request.json()) as Record<string, unknown>;

    const { data, error } = await supabase
      .from("activities")
      .update(body)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "활동 저장에 실패했습니다.");
    }

    return apiOk({ activity: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "활동 저장에 실패했습니다.";
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
      .from("activities")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id");

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      throw new Error("활동 삭제 권한이 없습니다.");
    }

    return apiOk({ id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "활동 삭제에 실패했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
