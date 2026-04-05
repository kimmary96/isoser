// 루트 레이아웃 - 모든 페이지에 공통으로 적용되는 HTML 구조
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "이소서 - AI 이력서 코치",
  description: "AI가 옆에서 코치하는 이력서·경력기술서 편집 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
