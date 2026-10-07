"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ROUTES } from "@/constants";
import { useCoverMap } from "@/hooks/use-cover-map";
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
 * **화면 통째, 반투명 유리다** (S15P21A405-703, 사용자 결정). 불투명한 판이던 것을 유리로 바꿔 뒤의
 * 지도가 흐리게 비친다. 한때 곡 상세 시트처럼 윗줄 아래에서 띄워 봤다가, 탭 화면은 지도 위 판이
 * 아니라 페이지라서 다시 꼭대기부터 채웠다. 유리 너머로 윗줄(검색·레이어 자취)이 비치지 않게
 * 그쪽은 `globals.css` 가 감춘다. 머리글은 지도 패널보다 위아래를 넉넉히 준다 — 페이지 제목 자리다.
 *
 * **높이를 화면 높이로 못 박는다** — `top-0` + `h-dvh`. 위아래 두 변(`top`·`bottom`)으로 잡던 때 어떤
 * 화면에서는 판이 내용 높이만큼 바닥에서 솟아 서서, 안의 목록이 굴러가지 않고 통째로 박혔다. 높이가
 * 정해져 있어야 안의 목록(`Box` 본문 · 차트 · 마이페이지 · 주변 사람)이 제 안에서 스크롤된다.
 *
 * **층은 네비(23) > 재생바(21) > 이 화면(20) > 지도** (사용자 결정). 재생바는 어느 탭에서도 늘 떠 있고,
 * 이 화면은 재생바·네비 뒤까지 내려간다 — 목록 끝 여백은 `globals.css` 가 붙인다. 재생바가 이 화면 위로
 * 올라올 수 있는 건 `main-screen` 의 판이 `absolute` 라서다(그쪽 주석).
 *
 * **머리글 높이를 68px 로 못 박는다.** 탭 화면에서는 ← · ✕ 가 빠지는데(돌아갈 곳도 닫을 곳도 없다)
 * 마이페이지에만 메뉴 버튼(28px)이 남아서, 탭을 오갈 때 머리글 높이가 탭마다 달라 제목 줄이 들썩였다.
 * 위 24 + 28 + 아래 16 = 68.
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

  // 화면 전체를 덮으므로 그동안 지도는 그리기를 쉰다 (S15P21A405-737)
  useCoverMap(enabled);

  if (!enabled) return null;

  return (
    <main
      data-panel-screen
      className="glass-bar fixed inset-x-0 top-0 z-[20] flex h-dvh flex-col overflow-hidden rounded-none border-0! pt-[env(safe-area-inset-top,0px)] shadow-none! [&>section>header]:h-[68px] [&>section>header]:pt-6 [&>section>header]:pb-4 [--glass-blur:18px] [--glass-tint:rgb(6_9_17/0.6)] [&>section]:min-h-0 [&>section]:flex-1 [&>section]:rounded-none! [&>section]:border-0 [&>section]:bg-transparent [&>section]:shadow-none [&>section]:backdrop-filter-none">
      {children}
    </main>
  );
}
