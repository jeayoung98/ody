"use client";

import { useDismountMutation } from "@/hooks/mutations/use-dismount-mutation";
import { useFeatures } from "@/hooks/use-features";
import { useFollowStore } from "@/stores/use-follow-store";
import RideChip, { RIDE_CHIP_ACTION } from "./ride-chip";

/**
 * 폰에서 **내가 따라가고 있을 때**의 표시 — 레이어 설명 바로 아래 한 줄 (SOCIAL-08, S15P21A405-705).
 *
 *   ( ● 🚀 준서의 우주선 탑승 중 )  [하차]
 *
 * **윗줄을 비우지 않는다** (S15P21A405-705, 사용자 결정). S15P21A405-703 에서는 이 알약이 윗줄 가운데를
 * 쓰고 검색·주변 탐색·여정을 감췄다. 이제 태우는 쪽(`lead-chip`)과 같은 알약으로 레이어 설명 아래에
 * 두고, 윗줄은 그대로 보이되 잠긴 채 흐리게 남는다 — 지도는 인솔자 것이라 어차피 못 쓴다.
 *
 * 두 번째 줄 안내("지도 조작 잠김 · 하차하면 이 자리에서 이어갑니다")는 여전히 없다. **지도를 움직이려
 * 할 때 토스트로 알린다** — 드래그·휠·핀치는 `map-view.tsx` 의 `notifyMapLocked`, 별 누르기는 같은
 * 파일의 `RIDING_LOCKED` 가 말한다. 막힌 순간에 듣는 편이 늘 떠 있는 안내보다 잘 읽힌다.
 *
 * **하차는 알약 밖 오른쪽 버튼이다.** 따라가는 동안 열려 있는 유일한 조작이라 한 번에 닿아야 한다.
 */
export default function RideBar() {
  const features = useFeatures();
  const leaderEmail = useFollowStore((s) => s.leaderEmail);
  const leaderNickname = useFollowStore((s) => s.leaderNickname);
  const dismount = useDismountMutation();

  if (!features.social || leaderEmail == null) return null;

  return (
    <RideChip
      dot="violet"
      action={
        <button
          type="button"
          title="하차 — 이 자리에서 이어갑니다"
          onClick={() => dismount.mutate()}
          disabled={dismount.isPending}
          className={RIDE_CHIP_ACTION}
        >
          하차
        </button>
      }
    >
      🚀 <b className="font-semibold">{leaderNickname ?? leaderEmail}</b>의 우주선 탑승 중
    </RideChip>
  );
}
