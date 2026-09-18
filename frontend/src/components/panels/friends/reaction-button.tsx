"use client";

import { useState } from "react";
import { SmileIcon } from "@/components/common/icons";
import { REACTION_COOLDOWN_MS, type ReactionKey } from "@/constants";
import { useSendReactionMutation } from "@/hooks/mutations/use-send-reaction-mutation";
import { useMapStore } from "@/stores/use-map-store";
import { useReactionStore } from "@/stores/use-reaction-store";
import ReactionPicker from "./reaction-picker";

/**
 * 반응 보내기 — **주변 사람 패널 안의 한 줄** (SOCIAL-02, S15P21A405-434). 기본 반응 세트를 고르면
 * 내 위로 떠서 사라진다. 우하단 FAB 였는데 플레이어바가 그 자리를 차지했고, 반응은 주변 사람에게
 * 보내는 것이라 그 목록 위에 있는 게 맞다.
 *
 * 전송 대상은 같은 영역 사용자 — 대상 지정 UI 확정 전까지는 로컬 표시만.
 * 동일 사용자 반복 전송 제한(SOCIAL-04)은 lastSentAt 으로 처리.
 */
export default function ReactionButton() {
  const [open, setOpen] = useState(false);
  const push = useReactionStore((s) => s.push);
  const lastSentAt = useReactionStore((s) => s.lastSentAt);
  const markSent = useReactionStore((s) => s.markSent);
  const send = useSendReactionMutation();
  // 오버레이 뷰(별자리·주변 탐색)에서는 반응을 받지 않는다 — 띄울 지도가 가려져 있다
  const overlay = useMapStore((s) => s.viewMode) !== "default";

  const handlePick = (key: ReactionKey, toEmail?: string) => {
    push({ reactionKey: key, mine: true, fromEmail: null });
    if (toEmail) {
      const last = lastSentAt[toEmail] ?? 0;
      if (Date.now() - last < REACTION_COOLDOWN_MS) return;
      markSent(toEmail);
      send.mutate({ toEmail, reactionKey: key });
    }
    setOpen(false);
  };

  if (overlay) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        title="반응 보내기"
        aria-label="반응 보내기"
        aria-pressed={open}
        onClick={() => setOpen((v) => !v)}
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-pill border border-line transition-all duration-fast ${
          open ? "grad-bg border-transparent text-void shadow-glow-azure" : "text-ink-2 hover:border-line-2 hover:text-ink"
        }`}
      >
        <SmileIcon />
      </button>
      {open ? <ReactionPicker horizontal onPick={handlePick} /> : <span className="text-[12px] text-ink-3">주변 사람에게 반응 보내기</span>}
    </div>
  );
}
