"use client";

import IconButton from "@/components/common/icon-button";
import { CloseIcon } from "@/components/common/icons";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/constants";
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
   * **탭 화면에서는 아예 안 그린다** (S15P21A405-417). 거기서 이 컴포넌트는 하위 페이지의
   * 내용으로 들어가 있는데, 탭은 닫는 것이 아니라 **머무는 자리**다 — 다른 데로 가려면
   * 다른 탭을 누르면 된다. X 가 있으면 "닫으면 어디로 가지?" 가 생긴다.
   *
   * 지도 위에 뜬 패널·시트에서는 그대로 닫기다.
   */
  const pathname = usePathname();
  if (pathname !== ROUTES.home) return null;
  return (
    <IconButton label="패널 닫기" onClick={close} className="text-ink-2!">
      <CloseIcon />
    </IconButton>
  );
}
