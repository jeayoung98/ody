"use client";

import { useState } from "react";
import IconButton from "@/components/common/icon-button";
import { SirenIcon } from "@/components/common/icons";
import SongReportDialog from "./song-report-dialog";

/**
 * 패널 헤더의 곡 신고 (S15P21A405-377 · 378 · 384).
 *
 * 본문 버튼(`이 곡 신고`)에서 헤더 경광등 아이콘으로 옮겼다. 자주 쓸 것이 아니라 상시 자리를
 * 차지할 이유가 없고, 닫기 옆이 "이 곡에 대한 조치" 자리로 읽힌다.
 *
 * **아이콘만 남으므로 라벨을 반드시 붙인다** — 378 에서 약하게 뒀다가 아무도 못 찾은 적이 있다.
 * `IconButton` 이 `aria-label` 과 `title`(마우스 올리면 뜨는 말풍선)을 함께 단다.
 */
export default function SongReportButton({ musicId, title }: { musicId: number; title: string }) {
  /** 신고 팝업이 떠 있나 (S15P21A405-378). 고르면 보내고 닫힌다 */
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton label="이 곡 신고" onClick={() => setOpen(true)} active={open}>
        <SirenIcon />
      </IconButton>
      {open && <SongReportDialog musicId={musicId} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}
