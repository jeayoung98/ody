"use client";

import { useRef, useState } from "react";
import { ChevronLeftIcon, ListPlayIcon } from "@/components/common/icons";
import TransportButton from "@/components/common/transport-button";
import InfoHint from "@/components/common/info-hint";
import Note from "@/components/common/note";
import SectionTitle from "@/components/common/section-title";
import { NEARBY_COUNT } from "@/constants";
import { useRecordPlayMutation } from "@/hooks/mutations/use-record-play-mutation";
import { useMusicDetailQuery } from "@/hooks/queries/use-music-detail-query";
import { useStartActivity } from "@/hooks/use-start-activity";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";
import { usePlayerStore } from "@/stores/use-player-store";
import { useTutorialStore } from "@/stores/use-tutorial-store";
import type { MusicDetail } from "@/types";
import SongNearbyCard from "./song-nearby-card";

/** 카드 한 장 폭과 사이 간격(px). `song-nearby-card` 와 맞춘다 — 화살표가 한 장씩 밀 때 쓴다 */
const CARD_W = 112;
const CARD_GAP = 8;

/**
 * 줄을 미는 화살표. **갈 곳이 있을 때만 그린다** — 끝에 닿은 쪽은 아예 안 나온다.
 *
 * 호버에만 드러내지 않는다. 마우스로는 가로 휠이 없어서 이게 사실상 유일한 길인데, 숨겨 두면
 * **줄이 더 있다는 것도 미는 길이 있다는 것도 모른다.** 대신 얌전하게(80%) 둔다.
 */
function RailArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={side === "left" ? "이전 카드" : "다음 카드"}
      onClick={onClick}
      className={`glass absolute top-1/2 z-10 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-pill! text-ink-2 opacity-80 transition-opacity duration-fast hover:text-ink hover:opacity-100 ${
        side === "left" ? "left-1.5" : "right-1.5"
      }`}
    >
      <ChevronLeftIcon className={side === "right" ? "rotate-180" : ""} />
    </button>
  );
}

interface SongNearbyListProps {
  items: MusicDetail["nearby"];
  centerMusicId: number;
}

/**
 * .nb10 — 가까운 10곡을 좌우로 미는 카드 줄로 보여 준다 (S15P21A405-384).
 *
 * 카드를 누르면 **주변 탐색이 켜지고** 그 곡으로 옮겨간다. 고리는 늘 "지금 보는 곡" 을 중심으로
 * 다시 서므로, 카드를 타고 들어가며 이웃의 이웃을 따라갈 수 있다.
 */
export default function SongNearbyList({ items, centerMusicId }: SongNearbyListProps) {
  const viewMode = useMapStore((s) => s.viewMode);
  const nearbyCenterMusicId = useMapStore((s) => s.nearbyCenterMusicId);
  const enterNearby = useMapStore((s) => s.enterNearby);
  const selectMusic = useMapStore((s) => s.selectMusic);
  const { mutate: recordPlay } = useRecordPlayMutation();
  const openNeighborSong = usePanelStore((s) => s.openNeighborSong);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const currentMusicId = usePlayerStore((s) => s.currentMusicId);
  const startActivity = useStartActivity();
  const inNearby = viewMode === "nearby";
  /** 이 상세의 곡을 중심으로 고리가 서 있나 */
  const isOnHere = inNearby && nearbyCenterMusicId === centerMusicId;
  /**
   * **한 걸음 나와 있다** — 고리는 다른 곡 기준인데 이 곡의 상세를 보는 중 (S15P21A405-384).
   * 이 상태에서는 카드를 누르면 지도가 움직이므로, 화면이 그 사실을 미리 말해 줘야 한다.
   */
  const away = inNearby && !isOnHere;
  // 지도 중심에 선 곡. 방금까지 상세를 보던 곡이라 캐시에 있다
  const { data: centerSong } = useMusicDetailQuery(away ? nearbyCenterMusicId : null);
  const railRef = useRef<HTMLDivElement>(null);
  /**
   * 줄 끝에 닿았나 — 닿은 쪽 화살표는 감춘다. **마우스로는 가로 스크롤이 거의 안 된다**
   * (휠은 세로고, 가로는 shift+휠이나 트랙패드뿐이다). 그래서 화살표가 사실상 유일한 길이다.
   */
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const readEdges = (el: HTMLDivElement) => {
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  };
  /** 카드 한 장 + 사이 간격만큼 민다 — 스냅이 다음 카드 머리에 맞춰 세운다 */
  const nudge = (dir: 1 | -1) => railRef.current?.scrollBy({ left: dir * (CARD_W + CARD_GAP) * 2, behavior: "smooth" });


  /**
   * 10곡을 순서대로 듣는다 (S15P21A405-359). 열 번 눌러야 다 듣던 것을 한 번으로 줄인다 —
   * 이번 테스트가 묻는 게 "이 10곡이 닮게 들리나" 라 끝까지 듣는 사람이 많을수록 좋다.
   *
   * **중심곡을 큐의 첫 곡으로 넣는다** (S15P21A405-373). 설문이 묻는 것은 "기준곡과 닮았나" 라
   * 기준곡 소리를 먼저 들려줘야 답할 근거가 생긴다. 예전에는 "방금 듣던 곡" 이라는 전제로
   * 빼뒀는데, 상세만 열고 바로 순차 재생을 누르면 그 전제가 깨져 한 곡도 안 들은 채 이웃이
   * 시작됐다. 기준곡 자신은 이웃 목록에 없으므로 간선도 설문도 생기지 않는다.
   * 고리도 같이 켠다 — 소리는 이웃을 도는데 지도는 딴 데 있으면 무엇을 듣는지 안 보인다.
   */
  const handlePlayAll = () => {
    const ids = [centerMusicId, ...items.map((m) => m.id)];
    if (ids.length < 2) return;
    startActivity("nearby", String(centerMusicId), () => {
      if (!inNearby || nearbyCenterMusicId !== centerMusicId) enterNearby(centerMusicId);
      playQueue({ kind: "nearby", centerMusicId }, ids);
      recordPlay({ musicId: ids[0], source: "MAP", playedMs: 0 });
    });
  };

  /**
   * 이웃 카드를 고른다 — **한 걸음씩 옮겨 간다** (S15P21A405-384, 288).
   *
   * 고리는 그대로 두고 **표식만** 그 곡으로 간다. 상세도 그 곡으로 바뀌고 뒤로가기가 생긴다 —
   * 한 곡에 서서 이웃들을 차례로 들어보는 동작이라, 한 번 눌렀다고 지도를 통째로 옮기지 않는다.
   *
   * **그 이웃의 상세에서 또 이웃을 고르면 그때 고리가 옮겨 간다.** 이 상세의 곡이 중심이
   * 아니라는 것은 "한 걸음 나와 있다" 는 뜻이고, 거기서 또 한 걸음 나가려면 먼저 이 곡이
   * 중심이 되어야 한다. 중심이 옮겨가는 그림(1번만 남기고 넘어가는 전환)이 그 이동을 보여 준다.
   *
   * 패널은 여기서 직접 정한다. `enterNearby` 의 두 번째 인자가 `map-view` 의 "중심곡 상세를
   * 연다" 효과(348)를 비켜서게 한다 — 안 그러면 방금 고른 이웃을 중심곡이 덮어쓴다.
   *
   * **틀지는 않는다** (S15P21A405-453). 보는 것과 듣는 것은 따로다 — 카드는 상세를 옮기고,
   * 재생은 그 상세의 재생 버튼이 맡는다. 소리는 직전 곡에 머문다. 예전에는 여기서 묻지 않고
   * 틀었다 (S15P21A405-262).
   *
   * 설문은 그대로 돈다. 위의 `enterNearby` 가 고리를 켜 두므로 그 상세에서 재생을 누르면
   * `single` 재생이어도 탐색으로 잡히고(`playback-connection` 의 center 판정), 같은 간선이
   * 그때 생긴다 — 한 걸음 늦게 생길 뿐이다.
   */
  const handlePick = (id: number) => {
    // 한 걸음 나와 있었으면(이 곡이 중심이 아니면) 먼저 고리를 이 곡으로 옮긴다
    if (!isOnHere) enterNearby(centerMusicId, true);
    useTutorialStore.getState().complete("nearby");
    openNeighborSong(id, centerMusicId);
    selectMusic(id);
  };

  return (
    <div className="flex flex-col gap-2">
      {/*
        **지도 중심이 누구인지 여기서 말한다** (S15P21A405-384). 한 걸음 나와 있으면 같은 카드
        클릭이 "제자리에서 보기" 가 아니라 "옮겨가기" 가 되는데, 오른쪽 패널만 보고 있으면
        자기가 어느 상태인지 알 길이 없었다.
      */}
      {/*
        머리줄은 두 칸이다 (S15P21A405-446): 왼쪽에 제목과 안내를 붙이고, 오른쪽에 목록 재생.
        제목 줄 따로, 안내 상자 + 버튼 따로였을 때는 세 덩어리가 따로 놀았다.
        지도 중심이 누구인지도 여기서 말한다 (S15P21A405-384) — 한 걸음 나와 있으면 같은 카드
        클릭이 "제자리에서 보기" 가 아니라 "옮겨가기" 가 된다. 유사도 설명은 제목 옆 ⓘ 툴팁이다.
      */}
      <div className="flex items-center gap-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <SectionTitle
            tone="sentence"
            aside={
              away ? (
                <span className="block max-w-[110px] truncate text-teal" title={`지도는 ${centerSong?.title ?? "다른 곡"} 주변이에요`}>
                  {centerSong?.title ?? "다른 곡"} 주변
                </span>
              ) : inNearby ? (
                <span className="text-teal">주변 탐색 중</span>
              ) : undefined
            }
          >
            이 곡과 가장 비슷해요!{" "}
            <InfoHint label="유사도 설명">
              <b className="font-medium text-ink">유사도</b>는 소리를 16차원으로 압축한 좌표에서 잰 거리예요. 가까울수록 소리가 닮았다는 뜻이에요.
            </InfoHint>
          </SectionTitle>
          {/* 오른쪽 목록 재생 버튼이 무엇을 하는지 말하는 유일한 자리다 — 카드 클릭은
          눌러 보면 알지만 줄 세 개짜리 아이콘은 안 그렇다 */}
          <Note>{away ? "카드를 누르면 이 곡 주변으로 옮겨가요." : "오른쪽 버튼을 누르면 주변곡을 이어서 들어요."}</Note>
        </div>
        {/*
          **한 곡 재생과 다르게 생겨야 한다** (S15P21A405-384). 자리도 크기도 제목 줄의 재생
          버튼과 같아서, 같은 ▶ 를 달면 "이 곡 재생" 으로 읽힌다. 줄 세 개가 붙은 아이콘이
          **목록을 듣는 버튼**임을 말한다 — 껍데기는 앱의 그 동그란 재생 버튼 그대로다.
        */}
        <TransportButton label={`${NEARBY_COUNT}곡 순차 재생`} primary disabled={items.length === 0} onClick={handlePlayAll}>
          <ListPlayIcon size={15} />
        </TransportButton>
      </div>
      {/*
        **주변 탐색 켜는 버튼은 없다** (S15P21A405-384). 카드를 고르든 순차 재생을 누르든
        주변 탐색이 같이 켜지므로 따로 켤 일이 없다 — 하나의 일에 입구를 둘 두지 않는다.
        끄는 길은 그대로 넷이다: 좌상단 칩의 ✕, 하단 바 버튼, 패널 닫기, 줌아웃.
      */}
      {/*
        카드 줄. 좌우 패딩만큼 음수 마진을 줘서 **패널 가장자리 밑으로 흘러 나간다** — 줄이
        화면 밖으로 이어진다는 신호다. 카드 폭 112 + 사이 8 이라 두 장 반이 보인다.
      */}
      <div className="relative -mx-[15px]">
        <div ref={railRef} onScroll={(e) => readEdges(e.currentTarget)} className="rail flex snap-x snap-mandatory scroll-pl-[15px] gap-2 overflow-x-auto px-[15px] pb-0.5">
          {items.map((m, i) => (
            <SongNearbyCard
              key={m.id}
              musicId={m.id}
              title={m.title}
              artist={m.artist}
              rank={i + 1}
              playing={currentMusicId === m.id}
              onClick={() => handlePick(m.id)}
            />
          ))}
        </div>
        {!atStart && <RailArrow side="left" onClick={() => nudge(-1)} />}
        {!atEnd && <RailArrow side="right" onClick={() => nudge(1)} />}
      </div>
    </div>
  );
}
