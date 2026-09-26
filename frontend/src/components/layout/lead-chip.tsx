"use client";

import { useDisbandMutation } from "@/hooks/mutations/use-disband-mutation";
import { useFeatures } from "@/hooks/use-features";
import { useConfirmStore } from "@/stores/use-confirm-store";
import { useFollowStore } from "@/stores/use-follow-store";
import RideChip, { RIDE_CHIP_ACTION } from "./ride-chip";

/**
 * 폰에서 **내가 태우고 있을 때**의 표시 — 레이어 설명 바로 아래 한 줄 (SOCIAL-09, S15P21A405-703 · 705).
 *
 * 데스크톱의 상단 가운데 배너(`map/follow-banner.tsx`)를 폰에 그대로 두니 알약이 윗줄 바로 밑을
 * 가로막았다. 인솔자는 검색·주변 탐색·여정을 그대로 쓰므로 윗줄을 비울 수 없다 — 그래서 윗줄이
 * 아니라 레이어 자취·설명 아래에 인원만 한 줄로 둔다.
 *
 * **모두 내리기는 알약 오른쪽 밖에 있다** (S15P21A405-705). 예전에는 ⓘ 안에 한 겹 숨겨 뒀다.
 * 되돌릴 수 없는 일이라 누르면 확인을 한 번 더 받는다(데스크톱과 같은 문구).
 */
export default function LeadChip() {
  const features = useFeatures();
  const riding = useFollowStore((s) => s.leaderEmail != null);
  const followerCount = useFollowStore((s) => s.followerCount);
  const disband = useDisbandMutation();
  const ask = useConfirmStore((s) => s.ask);

  if (!features.social || riding || followerCount <= 0) return null;

  const confirmDisband = () =>
    ask({
      title: "따라오는 사람을 모두 내릴까요?",
      message: `${followerCount}명이 지금 자리에 남고, 듣던 곡은 끊기지 않아요. 내린 뒤에 다시 따라올 수 있어요.`,
      confirmLabel: "모두 내리기",
      cancelLabel: "취소",
      onConfirm: () => disband.mutate(),
    });

  return (
    <RideChip
      dot="teal"
      action={
        <button type="button" onClick={confirmDisband} disabled={disband.isPending} className={RIDE_CHIP_ACTION}>
          모두 내리기
        </button>
      }
    >
      🚀 <b className="num font-semibold">{followerCount}</b>명이 따라오는 중
    </RideChip>
  );
}
