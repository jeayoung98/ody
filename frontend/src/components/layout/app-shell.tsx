"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import AuthGuard from "@/components/auth/auth-guard";
import { APP_ROUTES } from "@/constants";
import BottomTabs from "./bottom-tabs";
import MainScreen from "./main-screen";

/**
 * 앱 화면의 **껍데기** (S15P21A405-417).
 *
 * 하단 탭이 여러 경로를 오가는데, 그 경로마다 지도를 새로 그리면 **매번 처음부터 불러온다** —
 * 겹 상주 집합을 받고 카메라를 맞추는 데 몇 초가 걸리고, 보던 자리도 잃는다. 게다가 재생은
 * 유튜브 임베드가 하는 일이라 (`player/youtube-embed.tsx`) 그게 떨어지면 **음악이 끊긴다.**
 *
 * 그래서 지도와 재생바는 **여기**, 루트 레이아웃 밑에 둔다. 루트 레이아웃은 경로가 바뀌어도
 * 안 풀리므로 지도는 그대로 살아 있고, 탭 화면(`/friends` `/chart` `/me`)은 그 **위에 덮인다.**
 * 지도 탭(`/`)의 페이지는 그래서 아무것도 안 그린다 — 지도는 이미 여기 있다.
 *
 * **앱 화면일 때만 끼어든다.** 로그인·가입·튜토리얼·검색은 지금처럼 자기 화면만 그린다.
 * 데스크톱은 `/` 하나만 쓰므로 그리는 결과가 예전과 똑같다.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (!APP_ROUTES.includes(pathname)) return children;

  return (
    <AuthGuard>
      <MainScreen />
      {children}
      <BottomTabs />
    </AuthGuard>
  );
}
