// 브라우저용 Supabase 클라이언트 - 클라이언트 컴포넌트에서 사용
import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";

export function createBrowserClient() {
  return createSupabaseBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
