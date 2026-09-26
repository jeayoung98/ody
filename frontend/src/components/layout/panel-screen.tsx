"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ROUTES } from "@/constants";
import { usePanelEnabled } from "@/hooks/use-features";
import type { PanelType } from "@/constants";

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
 *
 * **이제 바텀시트처럼 선다** (S15P21A405-703, 사용자 결정). 위의 설명(불투명·화면 통째)을 뒤집었다 —
 * 곡 상세 시트와 같은 자리(윗줄 아래)에서 시작해 윗모서리 30px, 반투명 유리로 뒤의 지도가 흐리게
 * 비친다. 지도 탭과 같은 판이 올라온 것으로 읽혀야 한다는 판단이다. 아래는 재생바·네비 뒤까지
 * 내려가고, 목록 끝 여백은 `globals.css` 가 붙인다. 모서리도 거기서 건다(`[data-panel-screen]`).
 */
export default function PanelScreen({ panel, children }: { panel: PanelType; children: ReactNode }) {
  const router = useRouter();
  const panelEnabled = usePanelEnabled();
  const enabled = panelEnabled[panel];

  /**
   * **감춘 기능은 주소로도 못 연다** (S15P21A405-419).
   *
   * 우측 패널은 `right-panel.tsx` 가 같은 판정으로 막는다 — "레일에서만 막으면 플레이어바
   * 컨텍스트·지도 클릭 같은 다른 길로 열려 버린다" 는 이유였다. 탭 화면은 **제 주소**가
   * 있으므로 그 길이 하나 더 생긴 셈이다: 탭바에서 칸이 빠져 있어도 `/chart` 를 직접 치면
   * 열린다. 데스크톱에서 막아 둔 것이 폰에서 새면 안 되므로 여기서도 같은 판정을 쓴다.
   *
   * 지금은 `features.ts` 가 전부 켜져 있어 아무것도 안 걸린다 (S15P21A405-480) — 다시 무언가를
   * 감출 때 이 화면을 따로 챙기지 않아도 되게 미리 걸어 둔다.
   */
  useEffect(() => {
    if (!enabled) router.replace(ROUTES.home);
  }, [enabled, router]);

  if (!enabled) return null;

  return (
    <main
      data-panel-screen
      className="glass-bar fixed inset-x-0 top-[calc(var(--spacing-hud-t)+40px)] bottom-0 z-[22] flex flex-col overflow-hidden border-0! shadow-none! [--glass-blur:18px] [--glass-tint:rgb(6_9_17/0.6)] [&>section]:min-h-0 [&>section]:flex-1 [&>section]:rounded-none! [&>section]:border-0 [&>section]:bg-transparent [&>section]:shadow-none [&>section]:backdrop-filter-none">
      {children}
    </main>
  );
}
