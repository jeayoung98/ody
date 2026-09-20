"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { HelpIcon } from "@/components/common/icons";
import HelpDialog from "./help-dialog";
import { setAnalyticsContext, track } from "@/lib/analytics/client";

/**
 * 도움말 — 지도가 뭔지, 별이 뭔지 설명. **좌하단 계기판의 자식**으로 그 오른쪽에 선다 (S15P21A405-434) —
 * 계기판이 접히면 같이 따라 들어간다.
 *
 * **계기판에 거의 붙어 선다** (S15P21A405-479). 예전에는 접기 핸들(17)과 틈(9)을 비켜 70px 을
 * 밀었는데, 그만큼 화면 안쪽으로 나와 혼자 떠 있는 것처럼 보였다. 지금은 52px — 버튼 폭(44)에
 * 틈 8px 만 둔다. 핸들 자리와 가로로는 겹치지만 **세로로는 안 겹친다** — 핸들은 `top-1/2` 로
 * 가운데 있고 이 버튼은 `bottom-0` 이다.
 *
 * **검색창·네비바·프사와 같은 유리, 같은 44px 알약이다** (S15P21A405-477). 38px 짜리라 혼자
 * 작았고, 계기판 유리 **안에** 있어서 backdrop root 에 갇혀 블러가 먹지도 않았다 — 지금은
 * 계기판의 유리 밖(`minimap-panel` 의 aside 직계)에 서서 뒤의 별을 제대로 흐린다.
 *
 * 다이얼로그는 `document.body` 로 빼서 그린다. 계기판에 `transform` 이 걸려 있어서 안에 두면
 * `fixed inset-0` 이 화면이 아니라 계기판 안에 갇힌다 (신고 팝업과 같은 문제, S15P21A405-378).
 */
export default function HelpButton() {
  const [open, setOpen] = useState(false);
  const close = () => {
    track("help_closed");
    setAnalyticsContext({ help_open: false });
    setOpen(false);
  };
  return (
    <>
      <button data-hud data-analytics-manual
        type="button"
        aria-label="도움말"
        title="도움말"
        onClick={() => { track("help_opened"); setAnalyticsContext({ help_open: true }); setOpen(true); }}
        className="glass-liquid absolute -right-[52px] bottom-0 z-[22] grid h-11 w-11 place-items-center rounded-pill! text-ink-2 transition-colors hover:text-ink"
      >
        <HelpIcon />
      </button>
      {open && createPortal(<HelpDialog onClose={close} />, document.body)}
    </>
  );
}
