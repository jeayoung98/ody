"use client";

import IconButton from "@/components/common/icon-button";
import { CloseIcon } from "@/components/common/icons";
import { usePanelStore } from "@/stores/use-panel-store";

/**
 * 패널 닫기.
 *
 * 기본 아이콘 색(`text-ink-3`)보다 한 단계 밝게 쓴다 (S15P21A405-384) — 곡 상세는 헤더 뒤로
 * 앨범 커버가 지나가서 흐린 X 가 묻혔다. `!` 는 `IconButton` 의 기본 색을 확실히 덮기 위한 것이다.
 */
export default function PanelCloseButton() {
  const close = usePanelStore((s) => s.close);
  return (
    <IconButton label="패널 닫기" onClick={close} className="text-ink-2!">
      <CloseIcon />
    </IconButton>
  );
}
