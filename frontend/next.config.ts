// Next.js 설정 파일
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // react-pdf는 브라우저에서만 동작하므로 서버사이드 렌더링 제외 처리
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), "canvas"];
    }
    return config;
  },
};

export default nextConfig;
