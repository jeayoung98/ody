"use client";

import { useStopFollowMutation } from "@/hooks/mutations/use-follow-mutation";
import { useFollowStore } from "@/stores/use-follow-store";

/** #ticket — 따라가기 중 상단 배너 + 하차 버튼. 조작 제한 안내 (SOCIAL-08, SOCIAL-09) */
export default function FollowBanner() {
  const leaderEmail = useFollowStore((s) => s.leaderEmail);
  const leaderNickname = useFollowStore((s) => s.leaderNickname);
  const followerCount = useFollowStore((s) => s.followerCount);
  const stop = useFollowStore((s) => s.stop);
  const stopMutation = useStopFollowMutation();

  if (!leaderEmail) return null;

  const handleStop = () => {
    stopMutation.mutate(leaderEmail);
    stop();
  };

  return (
    <div className="glass animate-tin pointer-events-auto absolute top-[72px] left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-pill! py-[9px] pr-2.5 pl-3.5">
      <span className="animate-pulse-dot h-2 w-2 shrink-0 rounded-pill bg-violet shadow-[0_0_12px_#a67cff]" />
      <div>
        <div className="text-sm">
          🚀 <b className="font-semibold">{leaderNickname ?? leaderEmail}</b>의 우주선 탑승 중
        </div>
        <div className="num text-[9.5px] tracking-[0.05em] text-ink-3">동승 {followerCount}명 · 지도 조작 잠김 · 하차하면 이 자리에서 이어갑니다</div>
      </div>
      <button
        type="button"
        onClick={handleStop}
        disabled={stopMutation.isPending}
        className="rounded-pill border border-bad/30 bg-bad/[.14] px-[13px] py-[7px] text-xs text-[#ffb3bd] transition-colors hover:bg-bad/25"
      >
        하차
      </button>
    </div>
  );
}
