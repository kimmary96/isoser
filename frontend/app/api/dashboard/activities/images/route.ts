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

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    const formData = await request.formData();
    const activityId = String(formData.get("activityId") ?? "").trim() || "temp";
    const files = formData.getAll("files").filter((file): file is File => file instanceof File);

    if (files.length === 0) {
      return apiError("업로드할 파일이 없습니다.", 400, "BAD_REQUEST");
    }

    const urls: string[] = [];

    for (const file of files) {
      const extension = file.name.split(".").pop() ?? "png";
      const path = `${user.id}/${activityId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
      const fileBuffer = Buffer.from(await file.arrayBuffer());

      const { error } = await supabase.storage
        .from("activity-images")
        .upload(path, fileBuffer, {
          upsert: true,
          contentType: file.type || "application/octet-stream",
        });

      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from("activity-images").getPublicUrl(path);
      urls.push(data.publicUrl);
    }

    return apiOk({ urls });
  } catch (error) {
    const message = error instanceof Error ? error.message : "이미지 업로드에 실패했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
