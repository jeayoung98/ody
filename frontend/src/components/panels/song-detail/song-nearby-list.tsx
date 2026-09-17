"use client";

import { useRef, useState } from "react";
import Button from "@/components/common/button";
import { ChevronLeftIcon, CoronaIcon, PlayIcon } from "@/components/common/icons";
import Note from "@/components/common/note";
import SectionTitle from "@/components/common/section-title";
import { NEARBY_COUNT } from "@/constants";
import { useRecordPlayMutation } from "@/hooks/mutations/use-record-play-mutation";
import { usePlaySong } from "@/hooks/use-play-song";
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
 * .nb10 — 가까운 10곡. 버튼으로 주변 탐색을 켜거나 이 곡 주변으로 **건너간다**(항해).
 * 목록의 곡을 누르면 **들어보기만** 한다(정찰) — 고리는 그대로고 우주선만 그 별로 옮겨간다 (S15P21A405-288)
 */
export default function SongNearbyList({ items, centerMusicId }: SongNearbyListProps) {
  const viewMode = useMapStore((s) => s.viewMode);
  const nearbyCenterMusicId = useMapStore((s) => s.nearbyCenterMusicId);
  const enterNearby = useMapStore((s) => s.enterNearby);
  const selectMusic = useMapStore((s) => s.selectMusic);
  const playWithConfirm = usePlaySong();
  const { mutate: recordPlay } = useRecordPlayMutation();
  const openSong = usePanelStore((s) => s.openSong);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const currentMusicId = usePlayerStore((s) => s.currentMusicId);
  const startActivity = useStartActivity();
  const inNearby = viewMode === "nearby";
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
  // 주변 탐색 중인데 이 상세가 중심이 아닌 곡이면(이웃을 선택해 보는 중) 버튼은 건너가기다
  const canHop = inNearby && centerMusicId !== nearbyCenterMusicId;

  const handleEnter = () => {
    enterNearby(centerMusicId);
    useTutorialStore.getState().complete("nearby");
  };

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
   * 이웃 곡을 고른다 — 선택·상세·재생. **건너가지는 않는다** (S15P21A405-288): 한 곡에 서서
   * 이웃들을 차례로 들어보는 정찰이 되어야 하므로, 옮겨가는 것은 버튼으로만 한다.
   *
   * 재생은 꼭 부른다 — 안 부르면 상세만 옮겨가고 **소리는 직전 곡에 머문다.** 목록을 누르면
   * 그 곡이 나와야 한다 (S15P21A405-262).
   * 설문도 여기에 기댄다 — 안 들려준 곡을 두고 "비슷했나요"를 묻게 된다. // REMOVE-WITH-SURVEY
   */
  const handlePick = (id: number) => {
    selectMusic(id);
    openSong(id);
    // 순차 재생 중 목록 밖의 곡이면 먼저 물어본다 (S15P21A405-341)
    playWithConfirm(id, () => recordPlay({ musicId: id, source: "MAP", playedMs: 0 }));
  };

  return (
    <div className="flex flex-col gap-2">
      <SectionTitle aside={inNearby ? <span className="text-teal">주변 탐색 중</span> : undefined}>주변 음악 {NEARBY_COUNT}곡</SectionTitle>
      {/* 한 줄로 줄였다 (S15P21A405-384). 유사도 기준은 이번 유저 테스트가 묻는 것이라 남긴다 */}
      <Note>
        <b>유사도</b>는 임베딩 거리 기준 — 카드를 누르면 들어볼 수 있고, 줌아웃하면 주변 탐색이 풀려요.
      </Note>
      {/*
        행동 줄을 카드 위로 올린다. **여는 버튼만 둔다** (S15P21A405-339) — 끄는 길은 이미
        둘이다(좌상단 칩의 ✕, 우측 패널 닫기). 여기 세 번째를 두면 같은 일을 세 군데서 한다.
        왼쪽 버튼은 상황에 따라 `주변 탐색 켜기` ↔ `이 곡 주변으로 건너가기` 로 글자가 바뀌므로
        **아이콘만 두지 않는다** — 아이콘 하나로 두 뜻을 말할 수 없다.
      */}
      <div className="flex gap-1.5">
        <Button variant={inNearby && !canHop ? "secondary" : "primary"} className="min-w-0 flex-1" onClick={handleEnter}>
          <CoronaIcon size={13} /> {canHop ? "이 곡 주변으로" : "주변 탐색 켜기"}
        </Button>
        <Button className="shrink-0" onClick={handlePlayAll} disabled={items.length === 0}>
          <PlayIcon size={12} /> 순차 재생
        </Button>
      </div>
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
