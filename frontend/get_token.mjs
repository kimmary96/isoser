// 실행: node get_token.mjs

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

console.log(session.access_token);
