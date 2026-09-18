"use client";

import { useCallback, useEffect, useRef } from "react";
import { SEARCH_LOAD_MORE_MARGIN_PX } from "@/constants";

/**
 * 이 상자가 바닥에 닿았나. `SEARCH_LOAD_MORE_MARGIN_PX` 만큼 미리 인정한다 — 정확히 바닥에
 * 닿는 순간만 세면 소수점 스크롤 위치 때문에 안 불리는 브라우저가 있다.
 */
export function atBottom(box: { scrollTop: number; clientHeight: number; scrollHeight: number }): boolean {
  return box.scrollTop + box.clientHeight >= box.scrollHeight - SEARCH_LOAD_MORE_MARGIN_PX;
}

interface LoadMoreOnBottom {
  /** 더 받을 페이지가 남았는가 */
  hasMore: boolean;
  /** 지금 다음 페이지를 받는 중인가 */
  isLoadingMore: boolean;
  /** 지금 그려진 항목 수 — 늘어날 때마다 바닥을 다시 본다 */
  count: number;
  /** 바닥에 닿으면 부른다. 중복 호출 방지는 부르는 쪽(useInfiniteQuery)이 한다 */
  onLoadMore: () => void;
}

/**
 * 스크롤 상자가 바닥에 닿으면 다음 페이지를 부른다 (SEARCH-01).
 *
 * **바닥을 위치로 잰다, IntersectionObserver 로 재지 않는다.** 관찰을 거는 순간 한 번 콜백이
 * 오는데 그때 목록이 아직 안 그려져 있어서 **스크롤도 안 했는데 다음 페이지가 당겨졌다**
 * (실측: 첫 페이지만 떠 있어야 할 때 이미 20건). 한 페이지가 20초짜리 호출이라 그냥 낭비다.
 * 위치 비교는 그런 일이 없다.
 *
 * 돌려주는 `boxRef` 와 `onScroll` 을 스크롤 상자에 그대로 붙인다. 지도 상단 검색창과 여정
 * 만들기가 같은 검색을 서로 다른 상자에 그리므로 판정은 한 곳에 둔다 (S15P21A405-455).
 */
export function useLoadMoreOnBottom({ hasMore, isLoadingMore, count, onLoadMore }: LoadMoreOnBottom) {
  const boxRef = useRef<HTMLDivElement>(null);
  /** 콜백이 매 렌더 바뀌어도 검사 함수를 다시 만들지 않게 최신 것만 들고 있는다 */
  const loadMoreRef = useRef(onLoadMore);
  useEffect(() => {
    loadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  const check = useCallback(() => {
    const box = boxRef.current;
    if (!box || !hasMore || isLoadingMore) return;
    if (atBottom(box)) loadMoreRef.current();
  }, [hasMore, isLoadingMore]);

  // 결과가 상자 높이를 못 채우면 스크롤이 안 생겨 영영 안 불린다 — 목록이 바뀔 때마다 한 번 본다
  useEffect(() => check(), [check, count]);

  return { boxRef, onScroll: check };
}
