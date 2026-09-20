"use client";

import Box from "@/components/common/box";
import Button from "@/components/common/button";
import EmptyState from "@/components/common/empty-state";
import ErrorMessage from "@/components/common/error-message";
import Loading from "@/components/common/loading";
import Note from "@/components/common/note";
import { useNearbyPeopleQuery } from "@/hooks/queries/use-nearby-people-query";
import { useNearbyPeopleLive } from "@/hooks/use-nearby-people-live";
import { useRealtimeConnected } from "@/hooks/use-realtime-connected";
import PanelCloseButton from "../panel-close-button";
import FriendRow from "./friend-row";
import NearbyRadar from "./nearby-radar";
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
  /**
   * **구독해서 본다** (S15P21A405-493). 예전에는 `isConnected()` 를 렌더 중에 그냥 불렀는데,
   * 그러면 소켓이 나중에 붙어도 다시 렌더되지 않아 `enabled` 가 false 로 굳었다.
   */
  const connected = useRealtimeConnected();
  const { data, isLoading, isError, error, refetch } = useNearbyPeopleQuery(connected);
  // 델타도 연결됐을 때만 듣는다 — 예전에는 패널이 열리기만 하면 무조건 걸었다
  useNearbyPeopleLive(connected, refetch);

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
      {/*
        레이더가 위, 줄 목록이 아래다 (S15P21A405-496). 레이더는 **거리와 크기**를 한눈에
        보여주고, 목록은 레이더에 넣을 자리가 없는 것(듣는 곡 제목·만남 횟수)을 적는다.
        하나만 두면 둘 중 하나를 잃는다.
      */}
      {data && data.people.length > 0 && <NearbyRadar people={data.people} />}
      <div className="-mx-1.5 flex flex-col gap-0.5">
        {/*
          **연결 전에는 스피너를 돌리지 않는다** (S15P21A405-493). `enabled: false` 인 쿼리는
          TanStack Query v5 에서 `pending` 으로 멈춰 있어서, `isPending` 으로 스피너를 띄우면
          요청을 보낸 적도 없는데 영원히 "불러오는 중" 이 된다. 오류도 안내도 아닌 상태라
          사용자는 기다리는 것 말고 할 수 있는 게 없다. `isLoading` 은 실제로 요청이 날아가는
          동안만 참이다(= `isFetching && isPending`).
        */}
        {!connected && <EmptyState message="실시간 연결을 기다리는 중이에요. 연결되면 주변 사람이 보여요." />}
        {connected && isLoading && <Loading />}
        {noPlay && <EmptyState message="곡을 먼저 재생하면 비슷한 곡을 듣는 사람이 보여요." />}
        {temporary && (
          <div className="flex flex-col items-center gap-2 py-4">
            <EmptyState message="지금은 목록을 만들지 못했어요. 잠시 후 다시 시도해주세요." />
            <Button onClick={() => void refetch()}>다시 시도</Button>
          </div>
        )}
        {isError && !noPlay && !temporary && <ErrorMessage />}
        {connected && data && data.people.length === 0 && <EmptyState message="지금은 비슷한 곡을 듣는 사람이 없어요." />}
        {data?.people.map((p) => <FriendRow key={p.email} person={p} />)}
      </div>
    </Box>
  );
}
