"use client";

import { genreColor } from "@/constants/design-tokens";
import type { MusicSearchResult } from "@/types";

interface SearchResultListProps {
  results: MusicSearchResult[];
  isLoading: boolean;
  onSelect: (r: MusicSearchResult) => void;
}

/** #results .res */
export default function SearchResultList({ results, isLoading, onSelect }: SearchResultListProps) {
  return (
    <div className="glass mt-[7px] max-h-[46vh] overflow-y-auto rounded-[12px]!">
      {isLoading ? (
        <p className="px-[13px] py-[9px] text-xs text-ink-3">검색 중...</p>
      ) : results.length === 0 ? (
        <p className="px-[13px] py-[9px] text-xs text-ink-3">일치하는 곡이 없습니다.</p>
      ) : (
        results.map((r) => {
          const color = genreColor(r.id % 10);
          return (
            <button
              key={r.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(r)}
              className="flex w-full items-center gap-2.5 border-b border-white/[.045] px-[13px] py-[9px] text-left transition-colors last:border-b-0 hover:bg-white/[.06]"
            >
              <span className="h-[7px] w-[7px] shrink-0 rounded-pill" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] leading-[1.3]">{r.title}</span>
                <span className="block truncate text-[10.5px] text-ink-3">{r.artist ?? "-"}</span>
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}
