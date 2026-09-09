"use client";

import { useReactionStore } from "@/stores/use-reaction-store";
import FloatingReactionItem from "./floating-reaction-item";

/**
 * 반응 오버레이 (SOCIAL-02). 내 반응은 **지도 위 내 위치**에서, 남의 반응은 **그 사람 위치**에서 떠오른다.
 * 남의 반응은 그 사람이 내 뷰 안에 있을 때만 보인다 — 화면 밖이면 숨겨진다.
 */
export default function FloatingReactions() {
  const floating = useReactionStore((s) => s.floating);
  if (floating.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {floating.map((r) => (
        <FloatingReactionItem key={r.id} reaction={r} />
      ))}
    </div>
  );
}
