"use client";

import Box from "@/components/common/box";
import Button from "@/components/common/button";
import Note from "@/components/common/note";
import SkeletonRows from "@/components/common/skeleton-rows";
import { useNearbyPeopleQuery } from "@/hooks/queries/use-nearby-people-query";
import { useNearbyPeopleLive } from "@/hooks/use-nearby-people-live";
import { useRealtimeConnected } from "@/hooks/use-realtime-connected";
import { useFollowStore } from "@/stores/use-follow-store";
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
  /**
   * **따라가는 동안에는 부르지 않는다** (2차 실시간 명세 §6, S15P21A405-530).
   * `POST /api/realtime/nearby` 가 409 `RIDE_NOT_CAPTAIN` 으로 거부되는 경로다 — 부르면 패널에
   * 오류만 뜬다. 내 곡이 아니라 인솔자의 곡을 듣고 있으니 "내 주변" 이라는 기준 자체가 없다.
   */
  const riding = useFollowStore((s) => s.leaderEmail != null);
  const live = connected && !riding;
  const { data, isLoading, error, refetch } = useNearbyPeopleQuery(live);
  // 델타도 연결됐을 때만 듣는다 — 예전에는 패널이 열리기만 하면 무조건 걸었다
  useNearbyPeopleLive(live, refetch);

  const code = (error as { code?: string } | null)?.code;
  /** 아직 아무 곡도 재생하지 않았다 (§7.2 422). 사용자가 할 일이 분명하다 */
  const noPlay = code === "PRESENCE_ERROR";
  /** 비슷한 곡 계산이 잠깐 실패했다 (§12.7). **사용자 잘못이 아니다** */
  const temporary = code === "SERVICE_UNAVAILABLE";

  /**
   * 지금 보여 줄 안내 **하나** (S15P21A405-511). 급한 것부터 고른다 —
   * 내가 할 일(422) > 잠깐 실패(503) > 그냥 아무도 없음.
   *
   * 예전에는 셋을 각각 목록 자리에 `EmptyState`(점선 박스, py-22)로 깔았다. 그러면 상태가
   * 바뀔 때마다 패널 높이가 출렁이고 레이더와 가운데의 내가 밀려 올라간다 — 안내 한 줄 때문에
   * 화면의 중심이 움직이는 셈이었다. 이제 레이더 **위에 떠서** 흐름을 건드리지 않는다.
   */
  const notice = riding
    ? "따라가는 동안에는 주변 사람을 볼 수 없어요. 내리면 다시 보여요."
    : noPlay
    ? "곡을 먼저 재생하면 비슷한 곡을 듣는 사람이 보여요."
    : temporary
      ? "지금은 목록을 만들지 못했어요."
      : connected && data && data.people.length === 0
        ? "지금은 비슷한 곡을 듣는 사람이 없어요."
        : null;

  return (
    <Box title="주변 사람" actions={<PanelCloseButton />}>
      <Note>
        내가 듣는 곡과 <b>비슷한 곡</b>을 듣고 있는 사람입니다. 여기서의 거리는 실제 위치가 아니라 음악 지도상의 좌표 거리예요.
      </Note>
      {/*
        레이더가 위, 줄 목록이 아래다 (S15P21A405-496). 레이더는 **거리와 크기**를 한눈에
        보여주고, 목록은 레이더에 넣을 자리가 없는 것(듣는 곡 제목·만남 횟수)을 적는다.
        하나만 두면 둘 중 하나를 잃는다.
      */}
      {/*
        **판은 늘 그리고, 사람만 연결됐을 때 얹는다** (S15P21A405-496). 연결까지 기다렸다가
        그리면 실시간이 꺼져 있는 동안 패널에 빈 공간만 남아 무엇을 보는 화면인지 알 수 없다.
        눈금과 가운데의 나는 연결과 상관없이 참인 것들이라 먼저 보여 줘도 거짓말이 아니다.
      */}
      <div className="relative">
        <NearbyRadar people={connected && data ? data.people : []} />
        {/*
          안내는 레이더 **아래쪽에 떠 있는 알약**이다 (S15P21A405-511). 판 한가운데가 아니라
          아래 끝에 두는 이유는 가운데에 내가 있고 그 둘레가 사람 자리이기 때문이다 — 거기를
          덮으면 정작 볼 것을 가린다. 모양은 하단 토스트(`common/toast`)와 같은 글래스 알약이다.
        */}
        {notice && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
            <div className="glass-liquid animate-tin flex items-center gap-2 rounded-pill! px-3.5 py-2 text-center text-[11.5px] text-ink-2 shadow-[0_8px_28px_-10px_#000]">
              {notice}
              {/* 503 만 사용자가 할 수 있는 게 있다 — 그 버튼만 누를 수 있게 연다 */}
              {temporary && (
                <Button size="sm" className="pointer-events-auto shrink-0" onClick={() => void refetch()}>
                  다시 시도
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="-mx-1.5 flex flex-col gap-0.5">
        {/*
          **연결 전에는 스피너를 돌리지 않는다** (S15P21A405-493). `enabled: false` 인 쿼리는
          TanStack Query v5 에서 `pending` 으로 멈춰 있어서, `isPending` 으로 스피너를 띄우면
          요청을 보낸 적도 없는데 영원히 "불러오는 중" 이 된다. 오류도 안내도 아닌 상태라
          사용자는 기다리는 것 말고 할 수 있는 게 없다. `isLoading` 은 실제로 요청이 날아가는
          동안만 참이다(= `isFetching && isPending`).
        */}
        {connected && isLoading && <SkeletonRows count={4} thumb="circle" />}
        {/*
          그냥 실패했을 때는 **아무 말도 하지 않는다** (S15P21A405-509). 지도 별과 같은 판단이다
          (S15P21A405-508) — 사용자가 할 수 있는 게 없는 문구라, 레이더 밑에 한 줄 깔리면서
          가운데의 나를 위로 밀어낼 뿐이었다. 할 일이 있는 422·503 안내는 위에 그대로 남는다.
        */}
        {data?.people.map((p) => <FriendRow key={p.email} person={p} />)}
      </div>
      {/* 반응은 패널 **오른쪽 아래**다 (S15P21A405-496). 목록 위에 있으면 목록을 읽기 전에
          먼저 걸리는데, 반응은 보고 나서 하는 일이다 */}
      <div className="mt-1 flex justify-end">
        <ReactionButton />
      </div>
    </Box>
  );
}
