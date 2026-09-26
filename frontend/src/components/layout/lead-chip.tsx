"use client";

import { useRef, useState } from "react";
import { InfoIcon } from "@/components/common/icons";
import { useDisbandMutation } from "@/hooks/mutations/use-disband-mutation";
import { useDismissOnOutside } from "@/hooks/use-dismiss-on-outside";
import { useFeatures } from "@/hooks/use-features";
import { useConfirmStore } from "@/stores/use-confirm-store";
import { useFollowStore } from "@/stores/use-follow-store";

/**
 * 폰에서 **내가 태우고 있을 때**의 표시 — 레이어 설명 바로 아래 한 줄 (SOCIAL-09, S15P21A405-703).
 *
 * 데스크톱의 상단 가운데 배너(`map/follow-banner.tsx`)를 폰에 그대로 두니 알약이 윗줄 바로 밑을
 * 가로막았다. 인솔자는 검색·주변 탐색·여정을 그대로 쓰므로 윗줄을 비울 수 없다 — 그래서 윗줄이
 * 아니라 레이어 자취·설명 아래에 인원만 한 줄로 둔다.
 *
 * **모두 내리기는 ⓘ 안에 있다.** 되돌릴 수 없고 드문 일이라 한 겹 안에 두고, 누르면 확인을 한 번 더
 * 받는다(데스크톱과 같은 문구). 따라가는 쪽의 표시는 윗줄을 통째로 쓴다(`ride-bar.tsx`).
 */
export default function LeadChip() {
  const features = useFeatures();
  const riding = useFollowStore((s) => s.leaderEmail != null);
  const followerCount = useFollowStore((s) => s.followerCount);
  const disband = useDisbandMutation();
  const ask = useConfirmStore((s) => s.ask);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  useDismissOnOutside(boxRef, () => setOpen(false), open);

  if (!features.social || riding || followerCount <= 0) return null;

  const confirmDisband = () =>
    ask({
      title: "따라오는 사람을 모두 내릴까요?",
      message: `${followerCount}명이 지금 자리에 남고, 듣던 곡은 끊기지 않아요. 내린 뒤에 다시 따라올 수 있어요.`,
      confirmLabel: "모두 내리기",
      cancelLabel: "취소",
      onConfirm: () => {
        setOpen(false);
        disband.mutate();
      },
    });

  return (
    <div ref={boxRef} className="pointer-events-auto relative hidden w-fit max-w-[calc(100dvw-2*var(--spacing-gutter-sm))] flex-col gap-1.5 max-tablet:flex">
      <div className="glass-liquid flex min-w-0 items-center gap-2 rounded-pill! py-[5px] pr-1 pl-3 [--glass-tint:rgb(6_9_17/0.45)]">
        <span className="animate-pulse-dot h-1.5 w-1.5 shrink-0 rounded-pill bg-teal shadow-[0_0_10px_#4fe3ce]" />
        <span className="min-w-0 truncate text-[13.5px]">
          🚀 <b className="num font-semibold">{followerCount}</b>명이 따라오는 중
        </span>
        <button
          type="button"
          aria-label={open ? "설명 닫기" : "설명 보기"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-pill transition-colors ${open ? "text-ink" : "text-ink-3"}`}
        >
          <InfoIcon size={15} />
        </button>
      </div>
      {open && (
        <div className="glass-liquid animate-tin flex flex-col gap-2 rounded-box-sm! px-3 py-2.5 text-[12.5px] leading-[1.45] text-ink-2 [--glass-tint:rgb(6_9_17/0.7)]">
          <p>따라오는 사람들이 내 화면과 곡을 같이 봐요. 모두 내려도 그 자리에 남고, 듣던 곡은 끊기지 않아요.</p>
          <button
            type="button"
            onClick={confirmDisband}
            disabled={disband.isPending}
            className="self-start rounded-pill border border-bad/30 bg-bad/[.14] px-3 py-1.5 text-xs text-[#ffb3bd] transition-colors hover:bg-bad/25 disabled:opacity-50"
          >
            모두 내리기
          </button>
        </div>
      )}
    </div>
  );
}
