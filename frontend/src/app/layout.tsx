import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import SmallScreenGate from "@/components/layout/small-screen-gate";
import { devModeScript } from "@/constants/dev-mode";
import { TEST_TOOLS } from "@/constants/test-tools";
import QueryProvider from "@/providers/query-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "ODY",
  description: "음악을 좌표로 탐험하는 별지도",
};

/**
 * 뷰포트 기본기 (S15P21A405-420).
 *
 * Next 가 아무것도 안 주면 `width=device-width, initial-scale=1` 만 넣는다. 나머지 셋은 이유가 있다.
 *
 * **`viewportFit: "cover"`** — 이게 없으면 `env(safe-area-inset-*)` 이 **전부 0 을 돌려준다.**
 * 안전 영역 토큰(`tokens.css` 의 `--spacing-safe-*`)이 이 한 줄에 달려 있다. 화면을 노치 아래까지
 * 쓰게 하고, 대신 "어디가 가려지는지" 를 CSS 에 알려 준다 — 둘이 한 쌍이다.
 *
 * **`maximumScale: 1` / `userScalable: false`** — 이 앱의 확대는 **지도 자체가 맡는다.** 별을 보려고
 * 두 손가락으로 벌리면 지도가 파고들어야 하는데, 브라우저가 페이지를 통째로 확대해 버리면 HUD 까지
 * 같이 커지고 지도는 그대로다. 캔버스 위에서 핀치를 쓰는 앱이라 페이지 줌과 충돌한다.
 *
 * **접근성 비용을 인정한다.** 페이지 확대를 막는 것은 저시력 사용자에게 손해다. iOS 는 16 이후로
 * 이 설정을 무시하고 확대를 허용하므로 실제 차단은 안드로이드 크롬에서만 걸린다. 글자 크기 자체를
 * 키우는 쪽은 S15P21A405-417 에서 좁은 화면 타이포를 잡을 때 다시 본다.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

/**
 * 폰트는 next/font 대신 <link> 로 불러온다.
 * canvas 텍스트에서 실제 font-family 이름("IBM Plex Sans KR" 등)을 그대로 써야 하기 때문.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    /*
      `suppressHydrationWarning` 은 아래 개발 버전 스크립트 때문이다 (S15P21A405-421) — 하이드레이션
      전에 `<html>` 에 클래스를 붙이므로 서버가 그린 className 과 달라진다. 이 태그의 속성에만 적용된다.
    */
    <html lang="ko" className="h-full antialiased" style={{ colorScheme: "dark" }} suppressHydrationWarning>
      <head>
        {/*
          개발 버전 스위치 (S15P21A405-421). **빌드 스위치가 꺼지면 이 줄이 통째로 사라진다** —
          `TEST_TOOLS` 가 빌드 시각 상수라 최종 배포본에는 스크립트가 아예 안 실린다.
          `<head>` 에서 막고 도는 이유는 `constants/dev-mode.ts` 주석에 있다.
        */}
        {TEST_TOOLS && <script dangerouslySetInnerHTML={{ __html: devModeScript }} />}
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
        {/*
          좁은 화면 차단 (S15P21A405-379). **루트 레이아웃에 둔다** — 지도·튜토리얼·로그인 등
          모든 경로에 같이 걸려야 한다. 순수 CSS 라 JS 보다 먼저, JS 없이도 동작한다
        */}
        <SmallScreenGate />
      </body>
    </html>
  );
}
