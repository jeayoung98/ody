"use client";

import Box from "@/components/common/box";
import Button from "@/components/common/button";
import EmptyState from "@/components/common/empty-state";
import ErrorMessage from "@/components/common/error-message";
import Loading from "@/components/common/loading";
import Note from "@/components/common/note";
import { useNearbyPeopleQuery } from "@/hooks/queries/use-nearby-people-query";
import { useNearbyPeopleLive } from "@/hooks/use-nearby-people-live";
import { isConnected } from "@/lib/realtime/stomp-client";
import PanelCloseButton from "../panel-close-button";
import FriendRow from "./friend-row";
import ReactionButton from "./reaction-button";

/**
 * 주변 사람 (SOCIAL-01) — **내가 듣는 곡과 비슷한 곡을 듣는 사람** (S15P21A405-482).
 *
 * 기준이 바뀌었다. 예전에는 "지금 화면에 잡히는 구역"의 사람을 15초마다 폴링했고, 지금은
 * 화면 범위와 무관하게 **내 곡 기준**으로 가까운 순이다. 그래서 `layer` 인자가 없어졌다.
 *
 * 열 때 한 번 부르고, 이후 변화는 소켓 델타로 온다 (`useNearbyPeopleLive`). 폴링하지 않는다.
 */
export default function FriendsPanel() {
  const { data, isPending, isError, error, refetch } = useNearbyPeopleQuery(isConnected());
  useNearbyPeopleLive(true, refetch);

  const code = (error as { code?: string } | null)?.code;
  /** 아직 아무 곡도 재생하지 않았다 (§7.2 422). 사용자가 할 일이 분명하다 */
  const noPlay = code === "PRESENCE_ERROR";
  /** 비슷한 곡 계산이 잠깐 실패했다 (§12.7). **사용자 잘못이 아니다** */
  const temporary = code === "SERVICE_UNAVAILABLE";

  return (
    <Box title="주변 사람" actions={<PanelCloseButton />}>
      <Note>
        내가 듣는 곡과 <b>비슷한 곡</b>을 듣고 있는 사람입니다. 여기서의 거리는 실제 위치가 아니라 음악 지도상의 좌표 거리예요.
      </Note>
      {/* 반응은 주변 사람에게 보내는 것이라 그 목록 위에 둔다 (S15P21A405-434). 우하단 FAB 였다 */}
      <ReactionButton />
      <div className="-mx-1.5 flex flex-col gap-0.5">
        {isPending && <Loading />}
        {noPlay && <EmptyState message="곡을 먼저 재생하면 비슷한 곡을 듣는 사람이 보여요." />}
        {temporary && (
          <div className="flex flex-col items-center gap-2 py-4">
            <EmptyState message="지금은 목록을 만들지 못했어요. 잠시 후 다시 시도해주세요." />
            <Button onClick={() => void refetch()}>다시 시도</Button>
          </div>
        )}
        {isError && !noPlay && !temporary && <ErrorMessage />}
        {data && data.people.length === 0 && <EmptyState message="지금은 비슷한 곡을 듣는 사람이 없어요." />}
        {data?.people.map((p) => <FriendRow key={p.email} person={p} />)}
      </div>
    </Box>
  );
}
