"use client";

import { ArriveIcon, DepartIcon } from "@/components/common/icons";
import Note from "@/components/common/note";
import { usePlayability } from "@/hooks/queries/use-video-id-query";
import { useOpenJourneyComposer } from "@/hooks/use-open-journey-composer";
import { useJourneyStore } from "@/stores/use-journey-store";
import type { MusicDetail } from "@/types";

/** 세그먼트 한 칸 — 둘이 한 덩어리라 `Button` 을 쓰지 않는다 (테두리가 두 겹이 된다) */
const HALF = "flex flex-1 items-center justify-center gap-[7px] px-2 py-2.5 text-base transition-colors duration-fast hover:bg-white/[.07]";

/**
 * 이 곡을 여정의 **출발점 / 도착점**으로 지정 (JOURNEY-01).
 *
 * 둘을 **테두리 하나로 묶었다** (S15P21A405-384). 떨어뜨려 두면 남남으로 읽히는데 실제로는
 * 한 쌍이다. 버튼 글자에서 `여정` 을 뺐다 — 아이콘 색(출발 teal · 도착 violet)이 이미 한 쌍임을
 * 말하고, 글자가 짧아진 만큼 16px 로도 한 줄에 여유롭다. 눈에 보이는 글자는 짧게 두고,
 * 화면 낭독기에는 `aria-label` 로 온전한 문장을 준다.
 *
 * 아이콘 색은 여정 패널과 같다 (`journey-endpoints.tsx`): 출발 teal · 도착 violet.
 *
 * **재생·플리는 여기 없다.** 이 곡 하나에 대한 행동은 제목 줄로 모았다 (`song-header`).
 * 여기는 두 곡을 잇는 일만 남는다. 못 트는 곡 안내(`Note`)는 여기 남는다 — 여정에도 걸리는
 * 사정이라 행동 줄 가까이 있어야 한다.
 */
export default function SongActions({ music }: { music: MusicDetail }) {
  const setStart = useJourneyStore((s) => s.setStart);
  const setEnd = useJourneyStore((s) => s.setEnd);
  const openComposer = useOpenJourneyComposer();
  /** 왜 못 트는지 (SONG-04) — 판단은 `usePlayability` 한 곳에서 온다 */
  const { blocked } = usePlayability(music.id);

  return (
    <div className="flex flex-col gap-2">
      {/* 지점을 넣고 곧바로 확장 검색창으로 넘어간다 — 나머지 한 지점을 거기서 고른다 */}
      <div className="flex overflow-hidden rounded-box-sm border border-line bg-white/[.04]">
        <button
          type="button"
          aria-label="이 곡을 여정 출발점으로 지정"
          className={HALF}
          onClick={() => {
            setStart(music.id);
            openComposer("end");
          }}
        >
          <DepartIcon className="text-teal" /> 출발점으로
        </button>
        <span aria-hidden className="w-px shrink-0 bg-line" />
        <button
          type="button"
          aria-label="이 곡을 여정 도착점으로 지정"
          className={HALF}
          onClick={() => {
            setEnd(music.id);
            openComposer("start");
          }}
        >
          <ArriveIcon className="text-violet" /> 도착점으로
        </button>
      </div>
      {/*
        기능 ID(`SONG-04`)는 **화면에 적지 않는다** (S15P21A405-384). 개발자만 읽는 코드라
        사용자에게는 뜻 없는 글자다 — 패널 헤더의 `SONG-02` 를 뺀 것과 같은 이유다.
        값 자체는 남겨 둔다: 플레이어바가 분석 이벤트의 `reason` 으로 보낸다 (`player-bar`).
      */}
      {blocked && <Note>{blocked.detail}</Note>}
    </div>
  );
}
