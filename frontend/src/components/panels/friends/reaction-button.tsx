"use client";

import { useState } from "react";
import { SmileIcon } from "@/components/common/icons";
import { REACTION_REJECTED, type ReactionKey } from "@/constants";
import { useSendReactionMutation } from "@/hooks/mutations/use-send-reaction-mutation";
import { ApiError } from "@/lib/api";
import { isBot } from "@/lib/bots/roster";
import { useReactionStore } from "@/stores/use-reaction-store";
import { useToastStore } from "@/stores/use-toast-store";
import type { NearbyPerson } from "@/types";
import ReactionPicker from "./reaction-picker";

/**
 * 반응 보내기 — **주변 사람 패널 오른쪽 아래** (SOCIAL-02, S15P21A405-434·496). 기본 반응 세트를
 * 고르면 레이더 가운데(나) 위로 떠서 사라진다. 우하단 FAB 였는데 플레이어바가 그 자리를 차지해 패널 안으로
 * 들어왔고, 목록 위에 있다가 아래로 내려왔다 — 반응은 주변 사람을 **보고 나서** 하는 일이라
 * 목록보다 먼저 걸리면 순서가 뒤집힌다.
 *
 * **패널에 뜬 사람 전원에게 보낸다** (S15P21A405-607). 명세(FEATURES 18)는 반응이 "내 위로 떠서"
 * 주변에 보이는 것이라 특정 한 명에게 보내는 쪽지가 아니다. 백엔드는 받는 사람 한 명씩 받으므로
 * 여기서 펼쳐 보낸다. 봇은 서버에 없는 사람이라 건너뛴다. 재전송 제한(SOCIAL-04)은 서버 429 다.
 */
export default function ReactionButton({ people }: { people: NearbyPerson[] }) {
  const [open, setOpen] = useState(false);
  const push = useReactionStore((s) => s.push);
  const showToast = useToastStore((s) => s.show);
  const send = useSendReactionMutation();

  const handlePick = async (key: ReactionKey) => {
    setOpen(false);
    push({ reactionKey: key, mine: true, fromEmail: null });
    const targets = people.filter((p) => !isBot(p.email));
    if (targets.length === 0) return;
    const results = await Promise.allSettled(targets.map((p) => send.mutateAsync({ toEmail: p.email, reactionKey: key })));
    // 한 명에게라도 갔으면 조용히 넘긴다. 전부 거부됐을 때만 첫 사유를 말한다
    if (results.some((r) => r.status === "fulfilled")) return;
    const first = results[0] as PromiseRejectedResult;
    const code = first.reason instanceof ApiError ? first.reason.code : "UNKNOWN";
    showToast(REACTION_REJECTED[code as keyof typeof REACTION_REJECTED] ?? REACTION_REJECTED.UNKNOWN);
  };

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
