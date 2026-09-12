"use client";

import IconButton from "@/components/common/icon-button";
import { BackIcon } from "@/components/common/icons";
import { usePanelStore } from "@/stores/use-panel-store";

/**
 * 목록(여정·플리)에서 곡 상세로 들어왔을 때만 나오는 뒤로가기.
 * 돌아갈 자리가 없으면 **아무것도 그리지 않는다** — 지도에서 바로 연 상세에는 없어야 한다.
 */
export default function PanelBackButton() {
  const back = usePanelStore((s) => s.back);
  const goBack = usePanelStore((s) => s.goBack);
  if (!back) return null;
  return (
    <IconButton label={back.panel === "journey" ? "여정으로 돌아가기" : "플레이리스트로 돌아가기"} onClick={goBack}>
      <BackIcon />
    </IconButton>
  );
}
