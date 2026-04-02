// 소셜 로그인 콜백 페이지 - Supabase OAuth 콜백 처리 후 대시보드로 이동
"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

export default function CallbackPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);

  useEffect(() => {
    const handleCallback = async () => {
      const { error } = await supabase.auth.getSession();
      if (error) {
        console.error("로그인 처리 중 오류:", error);
        router.push("/login");
        return;
      }
      router.push("/dashboard");
    };

    handleCallback();
  }, [router, supabase]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">로그인 처리 중...</p>
    </main>
  );
}
