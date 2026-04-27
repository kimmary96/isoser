type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
} | null | undefined;

type SupabaseRouteClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ error: SupabaseErrorLike }>;
  from: (table: string) => {
    delete: () => {
      eq: (
        column: string,
        value: string,
      ) => PromiseLike<{ error: SupabaseErrorLike }>;
    };
  };
};

function isIgnorableRecommendationRefreshError(
  error: SupabaseErrorLike,
): boolean {
  if (!error) {
    return false;
  }

  const code = String(error.code ?? "").toUpperCase();
  const message = String(error.message ?? "").toLowerCase();
  return (
    code === "42883" ||
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST202" ||
    message.includes("refresh_user_recommendation_profile") ||
    message.includes("user_recommendation_profile") ||
    message.includes("user_program_preferences") ||
    message.includes("recommendation_normalize_text") ||
    message.includes("target_job")
  );
}

function isIgnorableRecommendationCacheError(
  error: SupabaseErrorLike,
): boolean {
  if (!error) {
    return false;
  }

  const code = String(error.code ?? "").toUpperCase();
  const message = String(error.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "42703" ||
    message.includes("recommendations") ||
    message.includes("profile_hash") ||
    message.includes("query_hash")
  );
}

async function runBestEffortMutation(
  label: string,
  action: () => PromiseLike<{ error: SupabaseErrorLike }>,
  isIgnorableError: (error: SupabaseErrorLike) => boolean,
): Promise<void> {
  try {
    const { error } = await action();
    if (error && !isIgnorableError(error)) {
      console.warn(`[recommendation-profile] ${label} failed`, error);
    }
  } catch (error) {
    console.warn(`[recommendation-profile] ${label} failed`, error);
  }
}

export async function syncRecommendationProfileAfterUserMutation(
  supabase: SupabaseRouteClient,
  userId: string,
): Promise<void> {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return;
  }

  await runBestEffortMutation(
    "refresh-profile",
    () =>
      supabase.rpc("refresh_user_recommendation_profile", {
        p_user_id: normalizedUserId,
      }),
    isIgnorableRecommendationRefreshError,
  );

  await runBestEffortMutation(
    "invalidate-cache",
    () =>
      supabase
        .from("recommendations")
        .delete()
        .eq("user_id", normalizedUserId),
    isIgnorableRecommendationCacheError,
  );
}
