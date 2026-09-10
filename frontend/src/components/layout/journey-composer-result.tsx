"use client";

import { genreColor } from "@/constants/design-tokens";
import { useMusicDetailQuery } from "@/hooks/queries/use-music-detail-query";
import type { MusicSearchResult } from "@/types";

interface JourneyComposerResultProps {
  result: MusicSearchResult;
  isStart: boolean;
  isEnd: boolean;
  /** 지금 편집 중인 칸에 넣는다 */
  onPick: () => void;
}

/** 여정 확장 검색 결과 한 줄. 장르색 막대 · 제목 · 아티스트만 둔다 */
export default function JourneyComposerResult({ result, isStart, isEnd, onPick }: JourneyComposerResultProps) {
  const { data } = useMusicDetailQuery(result.id);
  const color = genreColor(data?.genres[0]?.id ?? result.id % 10);
  const badge = isStart ? "출발" : isEnd ? "도착" : null;

  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full items-center gap-3 rounded-[9px] px-3 py-2 text-left transition-colors duration-fast hover:bg-white/[.06]"
    >
      <span className="h-[22px] w-[3px] shrink-0 rounded-pill" style={{ background: color }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px]">{result.title}</span>
        <span className="block truncate text-[11px] text-ink-3">{result.artist ?? "-"}</span>
      </span>
      {badge && <span className="lbl shrink-0 text-teal">{badge}</span>}
    </button>
  );
}
