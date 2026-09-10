import type { Metadata } from "next";
import type { ReactNode } from "react";
import QueryProvider from "@/providers/query-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "ODY",
  description: "음악을 좌표로 탐험하는 별지도",
};

/**
 * 폰트는 next/font 대신 <link> 로 불러온다.
 * canvas 텍스트에서 실제 font-family 이름("IBM Plex Sans KR" 등)을 그대로 써야 하기 때문.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className="h-full antialiased" style={{ colorScheme: "dark" }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* App Router 루트 레이아웃이라 모든 페이지에 적용된다 — pages/_document 기준 규칙은 해당 없음 */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Familjen+Grotesk:ital,wght@0,400..700;1,400..700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+KR:wght@300;400;500;600;700&display=swap"
        />
      </head>
      <body className="h-full">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
