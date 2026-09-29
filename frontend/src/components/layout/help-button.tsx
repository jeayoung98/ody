"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { HelpIcon } from "@/components/common/icons";
import { useIsNarrow } from "@/hooks/use-is-narrow";
import { usePanelStore } from "@/stores/use-panel-store";
import HelpDialog from "./help-dialog";
import { setAnalyticsContext, track } from "@/lib/analytics/client";

/**
 * 도움말 — 지도가 뭔지, 별이 뭔지 설명. **좌하단 미니맵 바로 위, 왼쪽 끝**에 선다 (S15P21A405-722, 사용자
 * 결정). 예전에는 계기판 유리 상자 오른쪽에 44px 알약으로 붙어 있었는데(S15P21A405-434 · 479), 상자와
 * 접기가 없어지면서 미니맵 위로 올라왔다. 미니맵 안에 넣어 봤더니 축소판 한 귀퉁이를 가려서 밖으로 뺐다.
 * 크기는 32px — 옆에 선 것이 없어 44 는 혼자 커 보인다. 유리는 그대로다.
 *
 * 다이얼로그는 `document.body` 로 빼서 그린다. 계기판에 `transform` 이 걸려 있어서 안에 두면
 * `fixed inset-0` 이 화면이 아니라 계기판 안에 갇힌다 (신고 팝업과 같은 문제, S15P21A405-378).
 */
export default function HelpButton() {
  const [open, setOpen] = useState(false);
  /**
   * **폰에서 시트가 펼쳐져 있으면 아예 없앤다** (S15P21A405-532).
   *
   * 다이얼로그는 `document.body` 에 z-50 으로 그려져서 시트(z-20) 위로 뜬다. 데스크톱에서는
   * 도움말이 지도 옆에 뜨는 모달이라 그게 맞지만, 폰에서는 시트가 화면을 통째로 덮고 있는
   * 위로 가이드가 또 얹혀 **두 화면이 겹쳐 보인다.**
   *
   * 다이얼로그의 z 를 내리는 대신 **버튼을 없앤다.** z 를 내리면 평소에 도움말을 열어도
   * 시트 뒤에 숨어 아무것도 안 보이게 된다 — 열 길을 막는 편이 맞다. 시트를 접거나 닫으면
   * 버튼이 돌아온다.
   */
  const narrow = useIsNarrow();
  const activePanel = usePanelStore((s) => s.activePanel);
  // 1 단(제목 줄만)이면 지도가 넉넉히 남으므로 도움말을 그대로 둔다 (S15P21A405-416)
  const snap = usePanelStore((s) => s.snap);
  const sheetUp = activePanel != null && snap > 1;
  const close = () => {
    track("help_closed");
    setAnalyticsContext({ help_open: false });
    setOpen(false);
  };
  if (narrow && sheetUp) return null;
  return (
    <>
      <button data-hud data-analytics-manual
        type="button"
        aria-label="도움말"
        title="도움말"
        onClick={() => { track("help_opened"); setAnalyticsContext({ help_open: true }); setOpen(true); }}
        // 폰에서는 안 보인다 (S15P21A405-703, 사용자 결정) — 윗줄 오른쪽 끝은 주변 탐색·여정이 차지한다
        className="glass-liquid absolute -top-10 left-0 z-[22] grid h-8 w-8 place-items-center rounded-pill! text-ink-2 transition-colors hover:text-ink max-tablet:hidden"
      >
        <HelpIcon />
      </button>
      {open && createPortal(<HelpDialog onClose={close} />, document.body)}
    </>
  );
}
