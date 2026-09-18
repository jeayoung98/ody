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

/**
 * 칩에 띄우는 조건 이름. **조건을 가리킬 때만 `제목`이다** — 결과를 가리키는 말은 `음악`
 * 그대로 둔다("일치하는 음악이 없습니다"). 둘은 다른 것을 가리키므로 같은 말로 묶지 않는다.
 */
const CHIP_LABEL = { artist: "아티스트", music: "제목" } as const;

/** 상태 → 검색 조건. 화면 상태와 요청 조건을 가르는 자리는 여기 하나다 */
function conditionOf(chip: Chip, input: string): SearchCondition {
  if (!chip) return { mode: "all", query: input };
  if (chip.kind === "artist") return { mode: "artist", artist: chip.value, music: input };
  return { mode: "music", music: chip.value, artist: input };
}

/**
 * #searchWrap — 상단 중앙 글래스 검색. 결과 클릭 시 지도상 위치로 이동 (SEARCH-01).
 *
 * **접혀 있는 게 기본이다** (S15P21A405-440). 포커스가 없으면 아이콘 + SEARCH 만 있는 작은 알약이고,
 * 누르면 같은 높이로 **옆으로 늘어나며** 입력이 열린다. 포커스가 상자 밖으로 나가면 다시 줄어든다.
 * 예전에는 패널이 열릴 때만 작은 버튼(`search-open-button`)으로 **교체**됐는데, 두 컴포넌트가
 * 자리를 바꿔 끼는 거라 움직임이 없었다. 이제 하나가 폭만 바꾼다 — 폭은 CSS transition 이 맡는다.
 *
 * 펼 때 우측 패널은 닫는다. 검색창과 사이드 패널은 동시에 뜨지 않는다는 규칙은 그대로다.
 */
export default function SearchBar() {
  const [input, setInput] = useState("");
  const [chip, setChip] = useState<Chip>(null);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

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
  const closePanel = usePanelStore((s) => s.close);

  const reset = () => {
    setInput("");
    setDebounced("");
    setChip(null);
  };

  /** 펴면서 입력에 포커스. 패널은 닫는다 */
  const expand = () => {
    closePanel();
    setExpanded(true);
    setOpen(true);
    // 입력은 접혀 있어도 DOM 에 있다 — 바로 포커스해도 된다
    requestAnimationFrame(() => inputRef.current?.focus());
  };
  const collapse = () => {
    setExpanded(false);
    setOpen(false);
  };
  /**
   * 포커스가 상자 **밖으로** 나갈 때만 접는다. 결과 목록 버튼으로 옮겨 가는 것은 밖이 아니다.
   * 한 박자 뒤에 재는 이유: 클릭으로 포커스가 옮겨 가는 사이에 activeElement 가 잠깐 body 다.
   */
  const handleBlur = () => {
    setTimeout(() => {
      if (!wrapRef.current?.contains(document.activeElement)) collapse();
    }, 120);
  };

  const handleSelect = (r: MusicSearchResult) => {
    analytics.select(r.id, results.findIndex((item) => item.id === r.id) + 1);
    collapse();
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
    <div
      ref={wrapRef}
      data-analytics-manual
      data-hud
      onBlur={handleBlur}
      // 폭만 바뀐다. 가운데 정렬(-translate-x-1/2)이라 양쪽으로 같이 늘어난다
      className={`absolute top-4 left-1/2 z-[22] -translate-x-1/2 transition-[width] duration-300 ease-out ${expanded ? "w-[min(420px,34vw)]" : "w-[104px]"}`}
    >
      {/* 접혀 있을 때는 상자 전체가 버튼이다 — 어디를 눌러도 펴진다 */}
      <div
        className={`glass flex h-11 items-center gap-[9px] overflow-hidden rounded-pill! pl-[15px] pr-[19px] ${expanded ? "" : "cursor-pointer hover:border-line-2"}`}
        onMouseDown={(e) => {
          if (expanded) return;
          e.preventDefault(); // 포커스가 상자로 갔다가 입력으로 옮겨 가며 깜빡이지 않게
          expand();
        }}
      >
        <SearchIcon className="shrink-0 opacity-50" />
        {expanded && chip && (
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
        {/* 접혀 있으면 폭 0 — 자리를 안 차지하면서도 포커스는 받을 수 있게 남긴다 */}
        <input
          ref={inputRef}
          tabIndex={expanded ? 0 : -1}
          aria-hidden={!expanded}
          className={`min-w-0 bg-transparent text-[13px] outline-none placeholder:text-ink-3 ${expanded ? "flex-1" : "w-0 flex-none"}`}
          placeholder={chip ? (chip.kind === "artist" ? "제목 검색..." : "아티스트 검색...") : "음악 · 아티스트 검색"}
          autoComplete="off"
          spellCheck={false}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setExpanded(true);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            // Escape 는 입력과 칩을 **모두** 지우고 접는다 (전달 문서 §2.1)
            if (e.key === "Escape") {
              reset();
              inputRef.current?.blur();
              collapse();
              return;
            }
            /**
             * 입력이 빈 상태의 Backspace 는 칩을 지운다 — 칩도 지워 나가는 글자처럼 다룬다.
             * 입력이 남아 있을 때는 평소대로 글자만 지운다. 글자를 지우다가 칩까지 같이
             * 날아가면 되돌릴 방법이 없다.
             */
            if (e.key === "Backspace" && !input && chip) {
              e.preventDefault();
              removeChip();
            }
          }}
        />
        <span className="lbl shrink-0">search</span>
      </div>
      {expanded && open && (chip || input.trim()) && (
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
