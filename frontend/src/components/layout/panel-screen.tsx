"use client";

import type { ReactNode } from "react";

/**
 * 하단 탭이 여는 **하위 화면**의 껍데기 (S15P21A405-417). 검색 화면(`search-screen.tsx`)과
 * 같은 모양이다 — 불투명한 배경이 화면을 통째로 덮고, 지도도 브랜드도 검색 알약도 안 보인다.
 *
 * 배경은 `stage-bg` 가 아니라 **평평한 `bg-void`** 다. `stage-bg` 의 방사 그라데이션은
 * 화면 위쪽(8% 지점)에서 가장 밝아서, 목록 화면에서는 머리글 언저리에 **남색 띠 한 줄**로
 * 보인다 — 별하늘 위에 얹힐 때나 쓰는 무늬지 글 읽는 화면의 바탕이 아니다.
 *
 * **지도 위에 뜬 카드가 아니다.** 처음엔 여백을 띄운 유리 상자로 만들었는데, 가장자리로
 * 지도가 비치고 위에는 브랜드·검색이 그대로 남아서 "페이지로 옮겨 온 것" 이 아니라
 * "패널이 또 하나 떴다" 로 읽혔다.
 *
 * 안에 들어가는 것은 우측 패널에 쓰던 그 컴포넌트 그대로다 — 데스크톱에서 오른쪽에 뜨던
 * 것이 폰에서는 한 화면이 된다. 두 벌로 만들지 않는다. 다만 그 `Box` 는 떠 있는 유리 상자라
 * 페이지에는 안 맞으므로, 여기서 **모서리·테두리·유리를 걷어 화면에 눕힌다**
 * (`[&>section]` — 자식을 알고 고치는 대신 바깥에서 한 줄로 덮는다).
 *
 * 아래는 재생바 위에서 끝난다 (`--nav-bottom`) — 듣던 곡은 어느 탭에서도 계속 보인다.
 * 탭바(z-23)는 그 아래에 그대로 떠 있다.
 */
export default function PanelScreen({ children }: { children: ReactNode }) {
  return (
    <main className="fixed inset-x-0 top-0 bg-void bottom-[var(--nav-bottom)] z-[22] flex flex-col pt-hud-t [&>section]:min-h-0 [&>section]:flex-1 [&>section]:rounded-none! [&>section]:border-0 [&>section]:bg-transparent [&>section]:shadow-none [&>section]:backdrop-filter-none">
      {children}
    </main>
  );
}
