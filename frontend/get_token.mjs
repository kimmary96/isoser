// 실행:
// - 안내만 보기: node get_token.mjs
// - 실제 토큰 출력: node get_token.mjs --print

import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: new URL("./.env.local", import.meta.url).pathname });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.log("세션 없음. 브라우저에서 로그인 후 다시 시도하세요.");
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const {
  data: { session },
} = await supabase.auth.getSession();

if (!session?.access_token) {
  console.log("세션 없음. 브라우저에서 로그인 후 다시 시도하세요.");
  process.exit(0);
}

if (!process.argv.includes("--print")) {
  console.log("보안상 기본 실행은 access token을 출력하지 않습니다.");
  console.log("정말 필요할 때만 `node get_token.mjs --print`로 실행하세요.");
  process.exit(0);
}

console.log(session.access_token);
