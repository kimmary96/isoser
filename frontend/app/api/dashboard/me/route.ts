import { apiError, apiOk } from "@/lib/api/route-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function fallbackName(email: string | null | undefined, metadataName: unknown): string {
  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }

  if (typeof email === "string" && email.includes("@")) {
    return email.split("@")[0];
  }

  return "사용자";
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return apiError("로그인이 필요합니다.", 401, "UNAUTHORIZED");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);

    const displayName =
      (typeof profile?.name === "string" && profile.name.trim()) ||
      fallbackName(user.email, user.user_metadata?.name ?? user.user_metadata?.full_name);

    return apiOk({
      user: {
        id: user.id,
        email: user.email ?? null,
        displayName,
        avatarUrl: profile?.avatar_url ?? null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "사용자 정보를 불러오지 못했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
