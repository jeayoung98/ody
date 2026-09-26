"use client";

import { useMapStore } from "@/stores/use-map-store";
import { useReactionStore } from "@/stores/use-reaction-store";
import FloatingReactionItem from "./floating-reaction-item";

/**
 * 반응 오버레이 (SOCIAL-02). 내 반응은 **지도 위 내 위치**에서, 남의 반응은 **그 사람 위치**에서 떠오른다.
 * 남의 반응은 그 사람이 내 뷰 안에 있을 때만 보인다 — 화면 밖이면 숨겨진다 (변경 제안 #18).
 *
 * S15P21A405-608 에서 걷어내고 주변 사람 레이더로 옮겼다가 되살렸다 (S15P21A405-694). 레이더는 패널을
 * 열어 둔 때만 보여서, 패널을 닫고 지도를 보는 동안 받은 반응이 아무 데도 안 떴다.
 */
export default function FloatingReactions() {
  const floating = useReactionStore((s) => s.floating);
  // 별자리·주변 탐색 오버레이 중에는 숨긴다 — 지도 위 요소는 오버레이 아래에 있어야 한다
  const overlay = useMapStore((s) => s.viewMode) !== "default";
  if (overlay || floating.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {floating.map((r) => (
        <FloatingReactionItem key={r.id} reaction={r} />
      ))}
    </div>
  );
}
