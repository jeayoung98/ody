"use client";

import { useState } from "react";
import { SmileIcon } from "@/components/common/icons";
import { REACTION_COOLDOWN_MS, type ReactionKey } from "@/constants";
import { useSendReactionMutation } from "@/hooks/mutations/use-send-reaction-mutation";
import { useMapStore } from "@/stores/use-map-store";
import { useReactionStore } from "@/stores/use-reaction-store";
import ReactionPicker from "./reaction-picker";

/**
 * 반응 보내기 — **주변 사람 패널 오른쪽 아래** (SOCIAL-02, S15P21A405-434·496). 기본 반응 세트를
 * 고르면 내 위로 떠서 사라진다. 우하단 FAB 였는데 플레이어바가 그 자리를 차지해 패널 안으로
 * 들어왔고, 목록 위에 있다가 아래로 내려왔다 — 반응은 주변 사람을 **보고 나서** 하는 일이라
 * 목록보다 먼저 걸리면 순서가 뒤집힌다.
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
    // 패널 **오른쪽 아래**에 선다 (S15P21A405-496). 버튼이 맨 오른쪽이고 고르는 칸은 왼쪽으로
    // 펼쳐진다 — 오른쪽으로 열면 패널 밖으로 나간다
    <div className="flex flex-row-reverse items-center gap-2">
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
      {/* 설명 글자는 뺐다 (S15P21A405-496) — 오른쪽 아래 구석이라 자리가 좁고, 웃는 얼굴만으로
          무엇인지 읽힌다. 뜻은 `title`·`aria-label` 이 들고 있어 스크린리더에도 남는다 */}
      {open && <ReactionPicker horizontal onPick={handlePick} />}
    </div>
  );
}
