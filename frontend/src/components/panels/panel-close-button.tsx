"use client";

import IconButton from "@/components/common/icon-button";
import { CloseIcon } from "@/components/common/icons";
import { useBackToMap } from "@/hooks/use-back-to-map";
import { usePanelStore } from "@/stores/use-panel-store";

/**
 * 패널 닫기.
 *
 * 기본 아이콘 색(`text-ink-3`)보다 한 단계 밝게 쓴다 (S15P21A405-384) — 곡 상세는 헤더 뒤로
 * 앨범 커버가 지나가서 흐린 X 가 묻혔다. `!` 는 `IconButton` 의 기본 색을 확실히 덮기 위한 것이다.
 */
export default function PanelCloseButton() {
  const close = usePanelStore((s) => s.close);
  /**
   * 폰에서 이 컴포넌트는 **하위 화면 안**에도 있다 (S15P21A405-417) — 거기서는 닫을 패널이
   * 아니라 떠날 화면이므로 지도 탭으로 돌아간다. 지도 위 패널이면 예전처럼 그냥 닫는다.
   */
  const backToMap = useBackToMap();
  return (
    <IconButton
      label="패널 닫기"
      onClick={() => {
        close();
        backToMap();
      }}
      className="text-ink-2!"
    >
      <CloseIcon />
    </IconButton>
  );
}
