"use client";

import { useState } from "react";
import { HelpIcon } from "@/components/common/icons";
import HelpDialog from "./help-dialog";
import { setAnalyticsContext, track } from "@/lib/analytics/client";

/** #topRight — 우상단 글래스 원형 버튼: 지도가 뭔지, 별이 뭔지 설명 */
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
        className="glass absolute top-4 right-[18px] z-[22] grid h-[38px] w-[38px] place-items-center rounded-pill! text-ink-2 transition-colors hover:text-ink"
      >
        <HelpIcon />
      </button>
      {open && <HelpDialog onClose={close} />}
    </>
  );
}
