"use client";

import Button from "@/components/common/button";
import UserRow from "@/components/common/user-row";
import { useStartFollowMutation } from "@/hooks/mutations/use-follow-mutation";
import { useStartActivity } from "@/hooks/use-start-activity";
import { useFollowStore } from "@/stores/use-follow-store";
import { useBackToMap } from "@/hooks/use-back-to-map";
import { usePanelStore } from "@/stores/use-panel-store";
import type { NearbyUser } from "@/types";

/** 프로필 컴포넌트: 프사 · 닉네임 · 따라가기 중이면 누구를 따라가는지 */
export default function FriendRow({ user }: { user: NearbyUser }) {
  const openFeed = usePanelStore((s) => s.openFeed);
  const leaderEmail = useFollowStore((s) => s.leaderEmail);
  const start = useFollowStore((s) => s.start);
  const follow = useStartFollowMutation();
  const startActivity = useStartActivity();
  /**
   * 따라가기는 **지도에서 벌어지는 일**이다 (S15P21A405-417). 폰에서 주변 사람은 제 화면이라,
   * 여기 남아 있으면 인솔자를 따라 움직이는 지도를 못 본다 — 누르는 순간 지도 탭으로 돌아간다.
   */
  const backToMap = useBackToMap();

  const isLeader = leaderEmail === user.email;

  return (
    <UserRow
      nickname={user.nickname}
      imageUrl={user.imageUrl}
      online={user.isOnline}
      caption={user.followingNickname ? `🚀 ${user.followingNickname} 님을 따라가는 중` : user.isOnline ? "탐색 중" : "오프라인"}
      onClick={() => {
        openFeed(user.email);
        // 남의 프로필은 패널로 뜬다 — 하위 화면에 있으면 그게 안 보이므로 지도로 돌아간다
        backToMap();
      }}
      actions={
        <Button
          size="sm"
          variant={isLeader ? "secondary" : "primary"}
          disabled={!user.isOnline || isLeader || follow.isPending}
          onClick={(e) => {
            e.stopPropagation();
            // ACT-01: 진행 중인 활동이 있으면 확인 후 멈추고 시작한다
            startActivity("follow", user.email, () => {
              follow.mutate(user.email);
              start(user.email, user.nickname);
              backToMap();
            });
          }}
        >
          {isLeader ? "탑승 중" : "따라가기"}
        </Button>
      }
    />
  );
}
