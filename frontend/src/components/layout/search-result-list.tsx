"use client";

import { useCallback, useEffect, useRef } from "react";
import { SEARCH_LOAD_MORE_MARGIN_PX } from "@/constants";
import { genreColor } from "@/constants/design-tokens";
import type { MusicSearchResult } from "@/types";

interface SearchResultListProps {
  results: MusicSearchResult[];
  isLoading: boolean;
  onSelect: (r: MusicSearchResult) => void;
  /** 더 받을 페이지가 남았는가 */
  hasMore: boolean;
  /** 지금 다음 페이지를 받는 중인가 */
  isLoadingMore: boolean;
  /** 바닥에 닿으면 부른다. 중복 호출 방지는 호출하는 쪽(useInfiniteQuery)이 한다 */
  onLoadMore: () => void;
}

/** #results .res — 바닥에 닿으면 다음 페이지를 이어 붙인다 (SEARCH-01) */
export default function SearchResultList({ results, isLoading, onSelect, hasMore, isLoadingMore, onLoadMore }: SearchResultListProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  /** 콜백이 매 렌더 바뀌어도 검사 함수를 다시 만들지 않게 최신 것만 들고 있는다 */
  const loadMoreRef = useRef(onLoadMore);
  useEffect(() => {
    loadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  /**
   * 바닥에 닿았는지 **스크롤 위치로** 잰다.
   *
   * IntersectionObserver 로 하면 관찰을 거는 순간 한 번 콜백이 오는데, 그때 목록이 아직 안 그려져 있어
   * **스크롤도 안 했는데 다음 페이지가 당겨졌다** (실측: 첫 페이지만 떠 있어야 할 때 이미 20건). 한 페이지가
   * 20초짜리 호출이라 그냥 낭비다. 위치 비교는 그런 일이 없다.
   */
  const checkBottom = useCallback(() => {
    const box = boxRef.current;
    if (!box || !hasMore || isLoadingMore) return;
    if (box.scrollTop + box.clientHeight >= box.scrollHeight - SEARCH_LOAD_MORE_MARGIN_PX) loadMoreRef.current();
  }, [hasMore, isLoadingMore]);

  // 결과가 목록 높이를 못 채우면 스크롤이 안 생겨 영영 안 불린다 — 목록이 바뀔 때마다 한 번 본다
  useEffect(() => checkBottom(), [checkBottom, results.length]);

  return (
    <div
      ref={boxRef}
      onScroll={checkBottom}
      // 스크롤바를 잡아도 검색창이 포커스를 잃지 않게 (잃으면 목록이 닫힌다)
      onMouseDown={(e) => e.preventDefault()}
      className="glass mt-[7px] max-h-[46vh] overflow-y-auto rounded-[12px]!"
    >
      {isLoading ? (
        <p className="px-[13px] py-[9px] text-xs text-ink-3">검색 중...</p>
      ) : results.length === 0 ? (
        <p className="px-[13px] py-[9px] text-xs text-ink-3">일치하는 곡이 없습니다.</p>
      ) : (
        <>
          {results.map((r) => {
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
          })}
          {/* 한 페이지에 20초 가까이 걸린다 — 멈춘 것처럼 보이지 않게 바닥에 상태를 남긴다 */}
          {isLoadingMore && <p className="px-[13px] py-[9px] text-center text-[11px] text-ink-3">다음 10곡 불러오는 중...</p>}
          {!hasMore && !isLoadingMore && <p className="px-[13px] py-[9px] text-center text-[11px] text-ink-4">결과 끝</p>}
        </>
      )}
    </div>
  );
}
