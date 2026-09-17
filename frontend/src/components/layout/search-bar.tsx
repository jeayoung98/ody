"use client";

import { useEffect, useRef, useState } from "react";
import { CloseIcon, SearchIcon } from "@/components/common/icons";
import { SEARCH_DEBOUNCE_MS } from "@/constants";
import { flattenSearch, useMusicSearchQuery } from "@/hooks/queries/use-music-search-query";
import { useSearchAnalytics } from "@/hooks/use-search-analytics";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";
import type { MusicSearchResult, SearchCondition } from "@/types";
import SearchResultList from "./search-result-list";

/**
 * 검색바가 들고 있는 상태 (S15P21A405-399).
 *
 * `chip` 이 확정한 **첫 조건**이고 `input` 은 남은 입력이다. 둘 다 칩으로 굳히는 네 번째
 * 상태를 만들지 않는 이유는, 첫 조건만 고정해도 세 경로가 전부 표현되기 때문이다.
 */
type Chip = { kind: "artist" | "music"; value: string } | null;

const CHIP_LABEL = { artist: "아티스트", music: "음악" } as const;

/** 상태 → 검색 조건. 화면 상태와 요청 조건을 가르는 자리는 여기 하나다 */
function conditionOf(chip: Chip, input: string): SearchCondition {
  if (!chip) return { mode: "all", query: input };
  if (chip.kind === "artist") return { mode: "artist", artist: chip.value, music: input };
  return { mode: "music", music: chip.value, artist: input };
}

/** #searchWrap — 상단 중앙 글래스 검색. 결과 클릭 시 지도상 위치로 이동 (SEARCH-01) */
export default function SearchBar() {
  const [input, setInput] = useState("");
  const [chip, setChip] = useState<Chip>(null);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /** 한 글자마다 묻지 않는다 — 닉네임 검사와 같은 길이로 맞춘다 */
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(input), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input]);

  const condition = conditionOf(chip, debounced);
  const { data, isPending, isSuccess, isError, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } = useMusicSearchQuery(condition);
  const results = flattenSearch(data?.pages);
  const analytics = useSearchAnalytics({
    keyword: chip ? `${chip.kind}:${chip.value} ${debounced}` : debounced,
    visible: open,
    pending: isPending,
    count: results.length,
    pages: data?.pages.length ?? 0,
    source: "map_search",
  });
  const focusMusic = useMapStore((s) => s.focusMusic);
  const openSong = usePanelStore((s) => s.openSong);

  const reset = () => {
    setInput("");
    setDebounced("");
    setChip(null);
  };

  const handleSelect = (r: MusicSearchResult) => {
    analytics.select(r.id, results.findIndex((item) => item.id === r.id) + 1);
    setOpen(false);
    reset();
    openSong(r.id);
    // 이 겹에 있으면 확대해 가고, 없으면 고스트별로 띄운다 — 레이어를 자동으로 옮기지 않는다 (SEARCH-01, MAP-12)
    focusMusic(r.id);
  };

  /** 입력값을 조건으로 굳힌다. 남은 입력은 비우고 포커스는 유지해 다음 조건을 바로 받는다 */
  const promote = (kind: "artist" | "music") => {
    const value = input.trim();
    if (!value) return;
    setChip({ kind, value });
    setInput("");
    setDebounced("");
    inputRef.current?.focus();
  };

  /** 칩을 뗀다. 남은 입력은 통합 검색어로 그대로 살린다 (전달 문서 §2.1) */
  const removeChip = () => {
    setChip(null);
    inputRef.current?.focus();
  };

  return (
    <div data-analytics-manual className="absolute top-4 left-1/2 z-[22] w-[min(380px,32vw)] -translate-x-1/2" data-hud>
      <div className="glass flex items-center gap-[9px] rounded-pill! px-[13px] py-[9px]">
        <SearchIcon className="shrink-0 opacity-50" />
        {chip && (
          <span className="flex shrink-0 items-center gap-1 rounded-pill bg-white/[.08] py-0.5 pr-1 pl-2 text-[11.5px] whitespace-nowrap text-ink-2">
            {CHIP_LABEL[chip.kind]}: {chip.value}
            <button
              type="button"
              aria-label={`${CHIP_LABEL[chip.kind]} 조건 제거`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={removeChip}
              className="cursor-pointer rounded-pill p-0.5 text-ink-3 transition-colors hover:text-ink"
            >
              <CloseIcon size={10} />
            </button>
          </span>
        )}
        <input
          ref={inputRef}
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-3"
          placeholder={chip ? (chip.kind === "artist" ? "음악 검색..." : "아티스트 검색...") : "음악 · 아티스트 검색"}
          autoComplete="off"
          spellCheck={false}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          // Escape 는 입력과 칩을 **모두** 지운다 (전달 문서 §2.1)
          onKeyDown={(e) => {
            if (e.key !== "Escape") return;
            reset();
            setOpen(false);
          }}
        />
        <span className="lbl">search</span>
      </div>
      {open && (chip || input.trim()) && (
        <SearchResultList
          condition={condition}
          input={input.trim()}
          results={results}
          isSuccess={isSuccess}
          isError={isError}
          onRetry={() => void refetch()}
          onSelect={handleSelect}
          onPromote={promote}
          hasMore={hasNextPage}
          isLoadingMore={isFetchingNextPage}
          onLoadMore={() => {
            analytics.more();
            void fetchNextPage();
          }}
        />
      )}
    </div>
  );
}
