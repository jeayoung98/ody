"use client";

import IconButton from "@/components/common/icon-button";
import { BackIcon } from "@/components/common/icons";
import { usePanelBack } from "@/hooks/use-panel-back";

/**
 * 곡 상세에서 목록(여정·플리)이나 직전 곡으로 돌아가는 화살표.
 *
 * **어디로 가는지는 패널 제목이 적는다** (S15P21A405-384) — 뒤로갈 곳이 있으면 제목이
 * `곡 상세` 대신 그 곡 제목이 되므로, 여기는 화살표만 둔다. 둘이 같은 답을 쓰도록
 * 판단은 [`usePanelBack`](../../hooks/use-panel-back.ts) 한 곳에서 온다.
 */
export default function PanelBackButton() {
  const back = usePanelBack();
  if (!back) return null;
  return (
    <IconButton label={`${back.label}(으)로 돌아가기`} onClick={back.go}>
      <BackIcon />
    </IconButton>
  );
}
