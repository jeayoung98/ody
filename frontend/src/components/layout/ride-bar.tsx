"use client";

import { CloseIcon } from "@/components/common/icons";
import { useDismountMutation } from "@/hooks/mutations/use-dismount-mutation";
import { useFeatures } from "@/hooks/use-features";
import { useFollowStore } from "@/stores/use-follow-store";

/**
 * 폰에서 **따라가는 동안 윗줄 자리**를 이 알약이 쓴다 (SOCIAL-08, S15P21A405-703, 사용자 결정).
 *
 *   ( ● 🚀 준서의 우주선 탑승 중  ✕ )   ← 윗줄 가운데
 *
 * 데스크톱의 상단 가운데 배너(`map/follow-banner.tsx`)를 폰에 그대로 두니 두 줄짜리 알약이 윗줄 바로
 * 밑을 가로막았다. 따라가는 동안에는 검색·주변 탐색·여정이 **어차피 잠겨 있으므로**(지도는 인솔자 것)
 * 그 자리를 비우고 이 알약을 세운다 — 감추는 쪽은 `globals.css` 의 `[data-ride-bar]` 규칙이다.
 *
 * **모양은 데스크톱 배너 그대로다** (사용자 결정) — 알약·점·하차 버튼까지 같고, **안에 든 것만 줄였다.**
 * 두 번째 줄 "지도 조작 잠김 · 하차하면 이 자리에서 이어갑니다" 는 뺐다. 미리 적어 두는 대신 **지도를
 * 움직이려 할 때 토스트로 알린다** — 드래그·휠·핀치는 `map-view.tsx` 의 `notifyMapLocked`, 별 누르기는
 * 같은 파일의 `RIDING_LOCKED` 가 이미 말한다. 막힌 순간에 듣는 편이 늘 떠 있는 안내보다 잘 읽힌다.
 *
 * **하차는 알약 끝의 연한 ✕ 다** (사용자 결정). 따라가는 동안 열려 있는 유일한 조작이라 한 번에 닿아야
 * 한다. 처음엔 배너처럼 빨간 `하차` 버튼이었는데, 버튼 높이만큼 알약이 48px 로 커져 바로 아래 레이어
 * 자취(윗줄 + 46px)에 닿았다. ✕ 는 24px 칸이라 알약이 38px 에 끝난다. 뜻은 `aria-label`·`title` 이 말한다.
 */
export default function RideBar() {
  const features = useFeatures();
  const leaderEmail = useFollowStore((s) => s.leaderEmail);
  const leaderNickname = useFollowStore((s) => s.leaderNickname);
  const dismount = useDismountMutation();

  if (!features.social || leaderEmail == null) return null;

  return (
    <div
      data-hud
      data-ride-bar
      className="absolute top-hud-t left-1/2 z-[22] hidden w-max max-w-[calc(100dvw-2*var(--spacing-gutter-sm))] -translate-x-1/2 max-tablet:flex"
    >
      {/* 배너(`follow-banner`)와 같은 알약 — 크기·여백·점·하차 버튼을 거기서 그대로 가져왔다 */}
      <div className="glass-liquid flex max-w-full min-w-0 items-center gap-3 rounded-pill! py-[9px] pr-2.5 pl-3.5">
        <span className="animate-pulse-dot h-2 w-2 shrink-0 rounded-pill bg-violet shadow-[0_0_12px_#a67cff]" />
        <span className="min-w-0 truncate text-sm">
          🚀 <b className="font-semibold">{leaderNickname ?? leaderEmail}</b>의 우주선 탑승 중
        </span>
        <button
          type="button"
          aria-label="하차"
          title="하차 — 이 자리에서 이어갑니다"
          onClick={() => dismount.mutate()}
          disabled={dismount.isPending}
          className="-ml-1 grid h-6 w-6 shrink-0 place-items-center rounded-pill text-ink-4 transition-colors hover:text-ink-2 disabled:opacity-50"
        >
          <CloseIcon size={13} />
        </button>
      </div>
    </div>
  );
}
