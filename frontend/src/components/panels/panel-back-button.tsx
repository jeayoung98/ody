"use client";

import IconButton from "@/components/common/icon-button";
import { BackIcon } from "@/components/common/icons";
import { usePanelBack } from "@/hooks/use-panel-back";

/**
 * 패널에서 목록(여정·플리)이나 직전 곡·프로필로 돌아가는 화살표. 돌아갈 곳이 없으면 그리지 않는다.
 *
 * 패널 제목은 늘 제 이름이다 — 곡 상세도 그렇다 (S15P21A405-716, 예전 384 에서는 곡 상세만 제목이 돌아갈 곳 이름이었다).
 * 어디로 가는지는 버튼의 이름(`○○(으)로 돌아가기`)이 말한다. 판단은 [`usePanelBack`](../../hooks/use-panel-back.ts) 한 곳에서 온다.
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
