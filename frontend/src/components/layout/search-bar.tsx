"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CloseIcon, SearchIcon } from "@/components/common/icons";
import { ROUTES } from "@/constants";
import { BREAKPOINTS } from "@/constants/design-tokens";
import { CHIP_LABEL, useMusicSearch } from "@/hooks/use-music-search";
import { usePanelStore } from "@/stores/use-panel-store";
import type { MusicSearchResult } from "@/types";
import SearchResultList from "./search-result-list";

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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closePanel = usePanelStore((s) => s.close);
  const { input, setInput, chip, inputRef, condition, results, query, reset, select, promote, removeChip, analytics } =
    useMusicSearch({ visible: open, source: "map_search" });
  const { isSuccess, isError, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  /**
   * 펴면서 입력에 포커스. 패널은 닫는다.
   *
   * **좁은 화면에서는 펴는 대신 `/search` 로 넘어간다** (S15P21A405-417). 375px 지도 위에서
   * 드롭다운을 펼치면 결과가 서너 줄밖에 안 보이고, 그 아래 지도는 어차피 가려진다.
   * 폭을 **누른 시점에** 재므로 렌더 분기가 아니다 — `BREAKPOINTS` 주석의 조건을 지킨다.
   */
  const expand = () => {
    closePanel();
    if (window.innerWidth < BREAKPOINTS.tablet) {
      router.push(ROUTES.search);
      return;
    }
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
    collapse();
    reset();
    select(r);
  };

  return (
    <div
      ref={wrapRef}
      data-analytics-manual
      data-hud
      onBlur={handleBlur}
      // 폭만 바뀐다. 가운데 정렬(-translate-x-1/2)이라 양쪽으로 같이 늘어난다.
      // 좁은 화면에서는 34vw 가 127px 밖에 안 돼 글자가 안 들어간다 — 여백만 빼고 다 쓴다 (S15P21A405-417)
      className={`absolute top-hud-t z-[22] transition-[width] duration-300 ease-out left-1/2 -translate-x-1/2 max-tablet:left-[calc(var(--spacing-gutter-sm)+34px)] max-tablet:translate-x-0 ${expanded ? "w-[min(420px,34vw)] max-tablet:w-[calc(100dvw-2*var(--spacing-gutter-sm))] max-tablet:left-gutter-sm" : "w-[104px] max-tablet:w-touch"}`}
    >
      {/* 접혀 있을 때는 상자 전체가 버튼이다 — 어디를 눌러도 펴진다 */}
      <div
        // 좁은 화면에서 접혀 있을 때는 아이콘만 남는 원이다 — 여백 41px 로는 44px 안에 못 들어간다
        className={`glass-liquid flex h-11 items-center gap-[9px] overflow-hidden rounded-pill! pl-[15px] pr-[26px] ${expanded ? "" : "cursor-pointer hover:border-line-2 max-tablet:justify-center max-tablet:px-0"}`}
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
        <span className={`lbl shrink-0 ${expanded ? "" : "max-tablet:hidden"}`}>search</span>
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
