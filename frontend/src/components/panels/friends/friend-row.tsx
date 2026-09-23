"use client";

import UserRow from "@/components/common/user-row";
import { useBackToMap } from "@/hooks/use-back-to-map";
import { useStartActivity } from "@/hooks/use-start-activity";
import { useRideMutation } from "@/hooks/mutations/use-ride-mutation";
import { useFollowStore } from "@/stores/use-follow-store";
import { usePanelStore } from "@/stores/use-panel-store";
import type { NearbyPerson } from "@/types";

/**
 * 주변 사람 한 줄 — 프사 · 닉네임 · **지금 듣는 곡** (S15P21A405-482).
 *
 * **따라가기 버튼을 되살렸다** (S15P21A405-530). 예전에는 숨겨 뒀다 — 탑승 API 가 배포에 없고
 * `riderCount` 도 늘 0 이라, 누를 수 있게 두면 눌리는데 아무 일도 안 일어났기 때문이다.
 * 지금은 `POST /api/realtime/ride` 가 배포에 있고 인솔자의 조작이 소켓으로 전파된다.
 *
 * 여기서 말하는 따라가기는 **탑승(ride)** 이다. 구독(follow)과 다르다 — 구독은 오래 남는
 * 관계이고 프로필 화면에 따로 있다.
 *
 * `isOnline` 자리도 뺐다 — 목록에 있다는 것이 곧 접속 중이라는 뜻이라(명세 §5.6) 늘 참이고,
 * 늘 참인 표시는 아무것도 말해 주지 않는다. 대신 그 자리에 듣는 곡을 적는다.
 */
export default function FriendRow({ person }: { person: NearbyPerson }) {
  const openFeed = usePanelStore((s) => s.openFeed);
  const leaderEmail = useFollowStore((s) => s.leaderEmail);
  const ride = useRideMutation();
  const startActivity = useStartActivity();
  /**
   * 폰에서 주변 사람은 **제 화면**이다 (S15P21A405-417). 남의 프로필은 지도 위 패널로 뜨므로,
   * 이 화면에 남아 있으면 눌러도 아무 일이 없어 보인다 — 누르는 순간 지도 탭으로 돌아간다.
   */
  const backToMap = useBackToMap();


  /**
   * 이미 그 사람을 따라가는 중이면 다시 누를 일이 없다. 다른 사람을 따라가는 중이면
   * `startActivity` 가 먼저 물어본다 (ACT-01) — 서버도 `RIDE_ALREADY_RIDING` 으로 막는다.
   */
  const isRidingThis = leaderEmail === person.email;
  const handleRide = () =>
    startActivity("follow", person.email, () => {
      ride.mutate({ email: person.email, nickname: person.nickname, imageUrl: person.imageUrl });
      backToMap();
    });

  return (
    <UserRow
      nickname={person.nickname ?? "이름 없음"}
      imageUrl={person.imageUrl}
      onClick={() => {
        openFeed(person.email);
        backToMap();
      }}
      right={
        <div className="flex items-center gap-2">
          {person.meetingCount > 0 && <span className="num text-xs text-ink-3">{person.meetingCount}번째</span>}
          {/* 줄 전체가 프로필로 가는 버튼이라, 여기서 클릭이 위로 올라가면 패널이 갈아탄다 */}
          <button
            type="button"
            disabled={isRidingThis || ride.isPending}
            onClick={(e) => {
              e.stopPropagation();
              handleRide();
            }}
            className="shrink-0 rounded-pill border border-violet/35 bg-violet/[.14] px-2.5 py-1 text-[11px] text-ink-2 transition-colors hover:bg-violet/25 disabled:opacity-45"
          >
            {isRidingThis ? "탑승 중" : "🚀 따라가기"}
          </button>
        </div>
      }
    />
  );
}
