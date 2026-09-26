"use client";

import { useRef, useState } from "react";
import { InfoIcon } from "@/components/common/icons";
import { useDismountMutation } from "@/hooks/mutations/use-dismount-mutation";
import { useDismissOnOutside } from "@/hooks/use-dismiss-on-outside";
import { useFeatures } from "@/hooks/use-features";
import { useFollowStore } from "@/stores/use-follow-store";

/**
 * 폰에서 **따라가는 동안 윗줄 전체**가 이 줄이 된다 (SOCIAL-08, S15P21A405-703, 사용자 결정).
 *
 *   ● 🚀 준서의 우주선 탑승 중 ⓘ ··············· [하차]
 *
 * 데스크톱의 상단 가운데 배너(`map/follow-banner.tsx`)를 폰에 그대로 두니 두 줄짜리 알약이 윗줄 바로
 * 밑을 가로막았다. 따라가는 동안에는 검색·주변 탐색·여정이 **어차피 잠겨 있으므로**(지도는 인솔자 것)
 * 그 자리를 비우고 이 한 줄로 채운다 — 감추는 쪽은 `globals.css` 의 `[data-ride-bar]` 규칙이다.
 * "지도 조작 잠김 · 하차하면 이 자리에서 이어갑니다" 는 ⓘ 를 눌러야 편다.
 *
 * **하차는 줄 끝이다.** 따라가는 동안 열려 있는 유일한 조작이라 한 번에 닿아야 한다 — ⓘ 안에 넣으면
 * 두 번 눌러야 나간다. 윗줄의 오른쪽 끝은 원래 동작 버튼 자리라 "여기서 뭔가를 한다" 로 읽힌다.
 *
 * 유리를 두르지 않는다. 윗줄의 다른 아이콘처럼 그늘(`top-scrim`) 위에 흰 글자로 뜬다.
 */
export default function RideBar() {
  const features = useFeatures();
  const leaderEmail = useFollowStore((s) => s.leaderEmail);
  const leaderNickname = useFollowStore((s) => s.leaderNickname);
  const dismount = useDismountMutation();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  useDismissOnOutside(boxRef, () => setOpen(false), open);

  if (!features.social || leaderEmail == null) return null;

  return (
    <div
      ref={boxRef}
      data-hud
      data-ride-bar
      className="absolute inset-x-gutter-sm top-hud-t z-[22] hidden flex-col gap-1.5 max-tablet:flex"
    >
      <div className="flex h-8 items-center gap-2">
        <span className="animate-pulse-dot h-1.5 w-1.5 shrink-0 rounded-pill bg-violet shadow-[0_0_10px_#a67cff]" />
        <span className="min-w-0 truncate text-[14.5px] text-ink drop-shadow-[0_1px_3px_rgb(0_0_0/0.7)]">
          🚀 <b className="font-semibold">{leaderNickname ?? leaderEmail}</b>의 우주선 탑승 중
        </span>
        <button
          type="button"
          aria-label={open ? "설명 닫기" : "설명 보기"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={`-ml-1 grid h-7 w-7 shrink-0 place-items-center rounded-pill drop-shadow-[0_1px_3px_rgb(0_0_0/0.7)] transition-colors ${open ? "text-ink" : "text-ink-2"}`}
        >
          <InfoIcon size={16} />
        </button>
        <button
          type="button"
          onClick={() => dismount.mutate()}
          disabled={dismount.isPending}
          className="ml-auto shrink-0 rounded-pill border border-bad/30 bg-bad/[.14] px-3.5 py-1.5 text-[13px] text-[#ffb3bd] transition-colors hover:bg-bad/25 disabled:opacity-50"
        >
          하차
        </button>
      </div>
      {open && (
        <p className="glass-liquid animate-tin w-fit rounded-box-sm! px-3 py-2 text-[12.5px] leading-[1.45] text-ink-2 [--glass-tint:rgb(6_9_17/0.7)]">
          지도 조작 잠김 · 하차하면 이 자리에서 이어갑니다
        </p>
      )}
    </div>
  );
}
