// Next.js 설정 파일
import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseRemotePattern = supabaseUrl
  ? (() => {
      try {
        const parsed = new URL(supabaseUrl);
        return [
          {
            protocol: parsed.protocol.replace(":", "") as "http" | "https",
            hostname: parsed.hostname,
            pathname: "/storage/v1/object/public/**",
          },
        ];
      } catch {
        return [];
      }
    })()
  : [];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseRemotePattern,
  },
  // react-pdf는 브라우저에서만 동작하므로 서버사이드 렌더링 제외 처리
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), "canvas"];
    }
    return config;
  },
};

export default nextConfig;
