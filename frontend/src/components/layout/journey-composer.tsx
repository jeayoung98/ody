"use client";

import { useEffect, useState } from "react";
import { CloseIcon } from "@/components/common/icons";
import { flattenSearch, useMusicSearchQuery } from "@/hooks/queries/use-music-search-query";
import { useLoadMoreOnBottom } from "@/hooks/use-load-more-on-bottom";
import { useJourneyStore } from "@/stores/use-journey-store";
import { usePanelStore } from "@/stores/use-panel-store";
import { useTutorialStore } from "@/stores/use-tutorial-store";
import JourneyComposerResult from "./journey-composer-result";
import JourneyComposerSlot from "./journey-composer-slot";
import { useSearchAnalytics } from "@/hooks/use-search-analytics";
import { requestJourney } from "@/lib/analytics/flows";
import { track } from "@/lib/analytics/client";

/**
 * 여정 만들기 확장 검색창 (JOURNEY-01).
 * 출발·도착 줄이 곧 검색 입력창이고, 뭔가 입력했을 때만 아래로 결과가 펼쳐진다.
 * 지도에서 곡을 눌러 채울 수도 있다. 지점을 바꾸는 것만으로는 아무 일도 없고,
 * **경로 만들기**를 눌러야 이전 경로가 사라지고 새 경로가 그려진다.
 */
export default function JourneyComposer() {
  const [keyword, setKeyword] = useState("");
  // 여정 만들기는 **통합 검색만** 쓴다 — 칩 UI 없이 조건 하나만 넘긴다 (S15P21A405-399)
  const { data, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } = useMusicSearchQuery({ mode: "all", query: keyword });
  const results = flattenSearch(data?.pages);
  /**
   * 결과를 끝까지 내리면 다음 10곡이 이어 붙는다 (S15P21A405-455). 전에는 첫 페이지에서
   * 끝나서, 17만 건 중 앞 10곡에 원하는 곡이 없으면 여정을 만들 수 없었다. 판정은 지도
   * 상단 검색창과 같은 훅이다 — 상자만 다르다.
   */
  const { boxRef, onScroll } = useLoadMoreOnBottom({
    hasMore: hasNextPage,
    isLoadingMore: isFetchingNextPage,
    count: results.length,
    onLoadMore: () => void fetchNextPage(),
  });
  const startMusicId = useJourneyStore((s) => s.startMusicId);
  const endMusicId = useJourneyStore((s) => s.endMusicId);
  const pickTarget = useJourneyStore((s) => s.pickTarget);
  const setStart = useJourneyStore((s) => s.setStart);
  const setEnd = useJourneyStore((s) => s.setEnd);
  const setPickTarget = useJourneyStore((s) => s.setPickTarget);
  const swap = useJourneyStore((s) => s.swap);
  const requestRoute = useJourneyStore((s) => s.requestRoute);
  const close = useJourneyStore((s) => s.closeComposer);
  const openJourneyPanel = usePanelStore((s) => s.openJourney);

  const ready = startMusicId != null && endMusicId != null && startMusicId !== endMusicId;
  const searching = keyword.trim().length > 0;
  const analytics = useSearchAnalytics({ keyword, visible: searching, pending: isPending, count: results.length, pages: data?.pages.length ?? 0, source: `journey_${pickTarget ?? "start"}` });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const focusSlot = (target: "start" | "end") => {
    if (pickTarget !== target) setKeyword("");
    setPickTarget(target);
  };

  /** 경로 만들기 = 유일한 확정 지점. 확정하면 결과 패널이 열리고 지도에 새 별자리가 그려진다 */
  const handleCreate = () => {
    if (!ready) return;
    requestJourney(startMusicId, endMusicId);
    requestRoute();
    openJourneyPanel();
    // 튜토리얼의 여정 단계는 **경로를 만든 순간** 끝난다 (S15P21A405-343)
    useTutorialStore.getState().complete("journey");
  };

  const pick = (musicId: number, target: "start" | "end") => {
    analytics.select(musicId, results.findIndex((r) => r.id === musicId) + 1);
    if (target === "start") setStart(musicId);
    else setEnd(musicId);
    setKeyword("");
  };

  return (
    <div data-analytics-manual data-hud data-tutorial="journey-composer" className="glass animate-tin absolute top-4 left-1/2 z-[24] w-[min(520px,46vw)] -translate-x-1/2 overflow-hidden rounded-[22px]! p-0!">
      <header className="flex items-center gap-2 px-4 pt-3">
        <span className="lbl">여정 만들기</span>
        <span className="flex-1" />
        <button type="button" onClick={close} aria-label="닫기" className="text-ink-3 transition-colors hover:text-ink">
          <CloseIcon size={13} />
        </button>
      </header>

      <div className="flex items-center gap-2 px-4">
        <div className="min-w-0 flex-1 divide-y divide-line">
          <JourneyComposerSlot
            role="start"
            musicId={startMusicId}
            active={pickTarget === "start"}
            keyword={keyword}
            onFocusSlot={() => focusSlot("start")}
            onKeywordChange={setKeyword}
            onClear={() => setStart(null)}
          />
          <JourneyComposerSlot
            role="end"
            musicId={endMusicId}
            active={pickTarget === "end"}
            keyword={keyword}
            onFocusSlot={() => focusSlot("end")}
            onKeywordChange={setKeyword}
            onClear={() => setEnd(null)}
          />
        </div>
        <button
          type="button"
          onClick={() => { track("journey_endpoints_swapped"); swap(); }}
          aria-label="출발·도착 바꾸기"
          title="출발·도착 바꾸기"
          className="shrink-0 rounded-pill px-2 py-1.5 text-[13px] text-ink-3 transition-colors hover:bg-white/[.07] hover:text-ink"
        >
          ⇅
        </button>
      </div>

      {/* 입력했을 때만 결과가 펼쳐진다 */}
      {searching && (
        <div ref={boxRef} onScroll={onScroll} className="max-h-[42vh] overflow-y-auto border-t border-line px-1.5 py-1.5">
          {isPending && <p className="lbl px-2 py-4 text-center">검색 중</p>}
          {!isPending && results.length === 0 && <p className="lbl px-2 py-4 text-center">일치하는 음악이 없습니다</p>}
          {results.map((r) => (
            <JourneyComposerResult
              key={r.id}
              result={r}
              isStart={r.id === startMusicId}
              isEnd={r.id === endMusicId}
              onPick={() => pick(r.id, pickTarget === "end" ? "end" : "start")}
            />
          ))}
          {/* 한 페이지에 20초 가까이 걸린다 — 멈춘 것처럼 보이지 않게 바닥에 상태를 남긴다 */}
          {isFetchingNextPage && <p className="lbl px-2 py-2 text-center">다음 10곡 불러오는 중...</p>}
          {results.length > 0 && !hasNextPage && !isFetchingNextPage && <p className="lbl px-2 py-2 text-center">결과 끝</p>}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5">
        <span className="text-[11px] text-ink-4">{ready ? "지도에서 눌러 바꿀 수도 있어요" : "지도에서 곡을 눌러도 채워집니다"}</span>
        <button
          type="button"
          onClick={handleCreate}
          disabled={!ready}
          data-tutorial="journey-create"
          className="grad-bg rounded-pill px-3.5 py-1.5 text-[12.5px] font-medium text-void transition-opacity duration-fast disabled:pointer-events-none disabled:opacity-30"
        >
          경로 만들기
        </button>
      </div>
    </div>
  );
}
