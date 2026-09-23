"use client";

import { useDisbandMutation } from "@/hooks/mutations/use-disband-mutation";
import { useDismountMutation } from "@/hooks/mutations/use-dismount-mutation";
import { useConfirmStore } from "@/stores/use-confirm-store";
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
  const followerCount = useFollowStore((s) => s.followerCount);
  const dismount = useDismountMutation();
  const disband = useDisbandMutation();
  const ask = useConfirmStore((s) => s.ask);

  /**
   * **내가 태우고 있을 때** — 인원 알림 + **강제 하차** (S15P21A405-545 · 606).
   *
   * 예전에는 이 자리가 없었다 — 탑승 알림이 없어서 누가 내릴 때까지 숫자를 몰랐고, 틀린
   * 숫자를 띄우느니 아무것도 안 띄우는 편이 나았다. 이제 탈 때와 내릴 때 모두 바뀐 인원이
   * 실려 오므로 그대로 믿을 수 있다.
   *
   * 인솔자의 조작은 막지 않는다. 강제 하차는 **전원**을 한 번에 내리는 되돌릴 수 없는 일이라
   * 확인을 한 번 받는다 (`DELETE /api/realtime/ride/fleet`). 내린 사람들은 내가 서 있는 곡에
   * 그대로 남고 듣던 곡도 끊기지 않는다 — 그걸 팝업 문구가 말한다.
   */
  if (!leaderEmail) {
    if (followerCount <= 0) return null;
    const confirmDisband = () =>
      ask({
        title: "따라오는 사람을 모두 내릴까요?",
        message: `${followerCount}명이 지금 자리에 남고, 듣던 곡은 끊기지 않아요. 내린 뒤에 다시 따라올 수 있어요.`,
        confirmLabel: "모두 내리기",
        cancelLabel: "취소",
        onConfirm: () => disband.mutate(),
      });
    return (
      <div className="glass-liquid animate-tin pointer-events-auto absolute top-[72px] left-1/2 z-30 max-tablet:z-[19] flex -translate-x-1/2 items-center gap-3 rounded-pill! py-[9px] pr-2.5 pl-3.5">
        <span className="animate-pulse-dot h-2 w-2 shrink-0 rounded-pill bg-teal shadow-[0_0_12px_#4fe3ce]" />
        <div className="text-sm">
          🚀 <b className="num font-semibold">{followerCount}</b>명이 따라오는 중
        </div>
        <button
          type="button"
          onClick={confirmDisband}
          disabled={disband.isPending}
          title="따라오는 사람을 모두 내립니다. 나는 이 자리에 그대로 있어요"
          className="rounded-pill border border-bad/30 bg-bad/[.14] px-[13px] py-[7px] text-xs text-[#ffb3bd] transition-colors hover:bg-bad/25 disabled:opacity-50"
        >
          강제 하차
        </button>
      </div>
    );
  }

  return (
    <div className="glass-liquid animate-tin pointer-events-auto absolute top-[72px] left-1/2 z-30 max-tablet:z-[19] flex -translate-x-1/2 items-center gap-3 rounded-pill! py-[9px] pr-2.5 pl-3.5">
      <span className="animate-pulse-dot h-2 w-2 shrink-0 rounded-pill bg-violet shadow-[0_0_12px_#a67cff]" />
      <div>
        <div className="text-sm">
          🚀 <b className="font-semibold">{leaderNickname ?? leaderEmail}</b>의 우주선 탑승 중
        </div>
        {/*
          **동승 인원은 여기 안 쓴다** (2차 명세 §14). 이 배너는 **따라가는 쪽**이 보는 것이라
          인솔자의 동승 인원과 관계가 없다.
        */}
        <div className="num text-[12px] tracking-[0.05em] text-ink-3">지도 조작 잠김 · 하차하면 이 자리에서 이어갑니다</div>
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
