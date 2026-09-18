"use client";

import Box from "@/components/common/box";
import EmptyState from "@/components/common/empty-state";
import ErrorMessage from "@/components/common/error-message";
import Loading from "@/components/common/loading";
import Note from "@/components/common/note";
import { useNearbyUsersQuery } from "@/hooks/queries/use-nearby-users-query";
import { useMapStore } from "@/stores/use-map-store";
import PanelCloseButton from "../panel-close-button";
import FriendRow from "./friend-row";
import ReactionButton from "./reaction-button";

/** 주변 친구: 현재 영역의 공개 계정 사용자 목록 (SOCIAL-01) */
export default function FriendsPanel() {
  const layer = useMapStore((s) => s.layer);
  const { data, isPending, isError } = useNearbyUsersQuery(layer);

  return (
    <Box title="주변 사람" actions={<PanelCloseButton />}>
      <Note>
        지금 화면에 잡히는 구역의 <b>공개 계정</b> 사용자입니다. 여기서의 거리는 실제 위치가 아니라 음악 지도상의 좌표 거리예요.
      </Note>
      {/* 반응은 주변 사람에게 보내는 것이라 그 목록 위에 둔다 (S15P21A405-434). 우하단 FAB 였다 */}
      <ReactionButton />
      <div className="-mx-1.5 flex flex-col gap-0.5">
        {isPending && <Loading />}
        {isError && <ErrorMessage />}
        {data && data.length === 0 && <EmptyState message="이 영역에는 지금 아무도 없습니다. 줌 아웃하거나 다른 곳으로 옮겨보세요." />}
        {data?.map((u) => <FriendRow key={u.email} user={u} />)}
      </div>
    </Box>
  );
}
