"use client";

import { useDismountMutation } from "@/hooks/mutations/use-dismount-mutation";
import { useFollowStore } from "@/stores/use-follow-store";

/**
 * 따라가기 중 상단 배너 + 하차 버튼 (SOCIAL-08 · SOCIAL-09, S15P21A405-530).
 *
 * **하차는 실연동이다.** 예전에는 로컬 상태만 지웠다 — 탑승 API 가 배포에 없었기 때문이다.
 * 지금은 `DELETE /api/realtime/ride` 를 부르고, 응답이 말하는 자리에 그대로 남는다.
 *
 * **따라가는 동안 열려 있는 유일한 조작이다** (2차 명세 §6). 나갈 수 없는 상태는 그 자체로
 * 결함이라, 지도·재생·패널이 전부 잠긴 중에도 이 버튼만 산다.
 */
export default function FollowBanner() {
  const leaderEmail = useFollowStore((s) => s.leaderEmail);
  const leaderNickname = useFollowStore((s) => s.leaderNickname);
  const dismount = useDismountMutation();

  if (!leaderEmail) return null;

  return (
    <div className="glass-liquid animate-tin pointer-events-auto absolute top-[72px] left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-pill! py-[9px] pr-2.5 pl-3.5">
      <span className="animate-pulse-dot h-2 w-2 shrink-0 rounded-pill bg-violet shadow-[0_0_12px_#a67cff]" />
      <div>
        <div className="text-sm">
          🚀 <b className="font-semibold">{leaderNickname ?? leaderEmail}</b>의 우주선 탑승 중
        </div>
        {/*
          **동승 인원은 여기 안 쓴다** (2차 명세 §14). 탑승 알림(`RIDE_RIDER_JOINED`)이 아직
          없어서 누가 탄 순간에는 숫자가 갱신되지 않는다 — 틀린 숫자보다 없는 편이 낫다.
          그리고 이 배너는 **따라가는 쪽**이 보는 것이라 인솔자의 동승 인원과도 관계가 없다.
        */}
        <div className="num text-[9.5px] tracking-[0.05em] text-ink-3">지도 조작 잠김 · 하차하면 이 자리에서 이어갑니다</div>
      </div>
      <button
        type="button"
        onClick={() => dismount.mutate()}
        disabled={dismount.isPending}
        className="rounded-pill border border-bad/30 bg-bad/[.14] px-[13px] py-[7px] text-xs text-[#ffb3bd] transition-colors hover:bg-bad/25 disabled:opacity-50"
      >
        하차
      </button>
    </div>
  );
}
