"use client";

import type { ReactNode } from "react";

/**
 * 하단 탭이 여는 **하위 화면**의 껍데기 (S15P21A405-417).
 *
 * 안에 들어가는 것은 우측 패널에 쓰던 그 컴포넌트 그대로다 — 데스크톱에서 오른쪽에 뜨던 것이
 * 폰에서는 한 화면이 된다. 같은 컴포넌트를 두 벌로 만들지 않는다.
 *
 * 지도 위에 덮이지만 지도를 끄지는 않는다 (`app-shell.tsx`) — 탭을 되돌리면 보던 자리 그대로다.
 * 아래는 재생바·탭바 위에서 끝난다 (`--nav-bottom`, `main-screen` 이 재서 html 에 심는다).
 *
 * z-[22]: HUD(20~21) 위, 탭바(23) 아래. 탭바는 언제나 손이 닿아야 한다.
 */
export default function PanelScreen({ children }: { children: ReactNode }) {
  return (
    <section className="animate-tin fixed inset-x-0 top-[72px] bottom-[var(--nav-bottom)] z-[22] flex flex-col px-gutter-sm">
      {children}
    </section>
  );
}
