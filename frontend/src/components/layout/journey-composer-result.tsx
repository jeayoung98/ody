"use client";

import { genreColor } from "@/constants/design-tokens";
import type { MusicSearchResult } from "@/types";

interface JourneyComposerResultProps {
  result: MusicSearchResult;
  isStart: boolean;
  isEnd: boolean;
  /** 지금 편집 중인 칸에 넣는다 */
  onPick: () => void;
}

/**
 * 여정 확장 검색 결과 한 줄. 색 막대 · 제목 · 아티스트만 둔다.
 *
 * **곡 상세 조회를 걷어냈다** (S15P21A405-490). 장르 하나 때문에 줄마다 `useMusicDetailQuery` 를
 * 걸고 있었는데, 장르가 응답에서 사라져(A-47) 그 조회가 쓸 데가 없어졌다. 검색 결과가 열 줄이면
 * 요청도 열 개였다 — 색은 예전 폴백대로 곡 id 로 흩뿌린다.
 */
export default function JourneyComposerResult({ result, isStart, isEnd, onPick }: JourneyComposerResultProps) {
  const color = genreColor(result.id % 10);
  const badge = isStart ? "출발" : isEnd ? "도착" : null;

  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full items-center gap-3 rounded-[11px] px-3 py-2 text-left transition-colors duration-fast hover:bg-white/[.06]"
    >
      <span className="h-[22px] w-[3px] shrink-0 rounded-pill" style={{ background: color }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px]">{result.title}</span>
        <span className="block truncate text-[12px] text-ink-3">{result.artist ?? "-"}</span>
      </span>
      {badge && <span className="lbl shrink-0 text-teal">{badge}</span>}
    </button>
  );
}
