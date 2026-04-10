// 소셜 로그인 콜백 페이지 - Supabase OAuth 콜백 처리 후 대시보드로 이동
"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { disableGuestMode } from "@/lib/guest";

export default function CallbackPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);

  useEffect(() => {
    const handleCallback = async () => {
      const code = new URL(window.location.href).searchParams.get("code");

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          // PKCE verifier 저장소가 비어도 이미 세션이 생성된 경우가 있어 fallback 확인을 진행한다.
          const message = exchangeError.message || "";
          const isPkceVerifierMissing = /code verifier/i.test(message);
          if (!isPkceVerifierMissing) {
            console.error("OAuth code 교환 오류:", exchangeError);
            router.replace("/login");
            return;
          }
        }
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error("로그인 사용자 확인 오류:", userError);
        router.replace("/login");
        return;
      }

      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("프로필 조회 오류:", profileError);
      }

      disableGuestMode();
      if (profileRow?.id) {
        router.replace("/dashboard");
        return;
      }
      router.replace("/onboarding");
    };

    void handleCallback();
  }, [router, supabase]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">로그인 처리 중...</p>
    </main>
  );
}
