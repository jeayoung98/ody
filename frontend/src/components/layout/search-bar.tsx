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
      /*
       * **접힌 폭은 내용이 정한다** (S15P21A405-649). `104px` 로 박혀 있었는데 안에 든 것은
       * 아이콘(16) + 틈(9) + `search` 라벨이라 실측 83.4px 이고, 좌우 여백까지 더하면 124px 가
       * 필요했다 — 넘친 20px 을 `overflow-hidden` 이 잘라서 오른쪽 여백이 없는 것처럼 보였다.
       * 라벨 크기를 올릴 때마다(9.5 → 11 → 12.5) 이 숫자가 조용히 어긋났으므로 `w-fit` 으로 둔다.
       *
       * `interpolate-size` 는 **펼침 애니메이션을 지키려고** 건다. 폭 전환은 원래 한쪽이
       * 내용폭이면 보간되지 않고 튀는데, 이 속성이 있으면 `fit-content` ↔ px 사이도 이어진다
       * (2026-09-25 크롬에서 확인: 300ms 중간 프레임이 실제로 사잇값이었다). 모르는 브라우저는
       * 그냥 튈 뿐이라 기능이 깨지지는 않는다.
       */
      className={`absolute top-hud-t z-[22] [interpolate-size:allow-keywords] transition-[width] duration-300 ease-out left-1/2 -translate-x-1/2 max-tablet:left-[calc(var(--spacing-gutter-sm)+34px)] max-tablet:translate-x-0 ${expanded ? "w-[min(420px,34vw)] max-tablet:w-[calc(100dvw-2*var(--spacing-gutter-sm))] max-tablet:left-gutter-sm" : "w-fit max-tablet:w-8"}`}
    >
      {/* 접혀 있을 때는 상자 전체가 버튼이다 — 어디를 눌러도 펴진다 */}
      <div
        // 좁은 화면에서 접혀 있을 때는 아이콘만 남는 원이다 — 여백 41px 로는 44px 안에 못 들어간다
        // `pl-[15px] pr-[26px]` 이었다 (S15P21A405-649). 고정폭 안에서 오른쪽을 더 줘 균형을 맞추던
        // 값인데, 폭이 내용을 따라가면 그냥 한쪽으로 치우친 여백이 된다 — 좌우를 같게 둔다
        // **폰에서는 유리를 벗긴다** (S15P21A405-703). 윗줄을 32px 로 낮추면서 검색·주변 탐색·여정을
        // 로고(26)와 같은 크기의 흰 아이콘으로 띄웠다. 폰은 누르면 `/search` 로 넘어가 펼칠 일이 없지만
        // 펼친 상자는 그래도 유리를 둔다
        className={`glass-liquid flex h-11 items-center gap-[9px] overflow-hidden rounded-pill! px-[15px] ${expanded ? "" : "cursor-pointer hover:border-line-2 max-tablet:h-8 max-tablet:justify-center max-tablet:px-0 max-tablet:glass-off"}`}
        onMouseDown={(e) => {
          if (expanded) return;
          e.preventDefault(); // 포커스가 상자로 갔다가 입력으로 옮겨 가며 깜빡이지 않게
          expand();
        }}
      >
        <SearchIcon className={`shrink-0 opacity-50 ${expanded ? "" : "max-tablet:size-6 max-tablet:text-ink max-tablet:opacity-100 max-tablet:drop-shadow-[0_1px_3px_rgb(0_0_0/0.7)]"}`} />
        {expanded && chip && (
          <span className="flex shrink-0 items-center gap-1 rounded-pill bg-white/[.08] py-0.5 pr-1 pl-2 text-[13.5px] whitespace-nowrap text-ink-2">
            {CHIP_LABEL[chip.kind]}: {chip.value}
            <button
              type="button"
              aria-label={`${CHIP_LABEL[chip.kind]} 조건 제거`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={removeChip}
              className="cursor-pointer rounded-pill p-0.5 text-ink-3 transition-colors hover:text-ink"
            >
              <CloseIcon size={12} />
            </button>
          </span>
        )}
        {/* 접혀 있으면 폭 0 — 자리를 안 차지하면서도 포커스는 받을 수 있게 남긴다 */}
        <input
          ref={inputRef}
          tabIndex={expanded ? 0 : -1}
          aria-hidden={!expanded}
          className={`min-w-0 bg-transparent text-[15px] outline-none placeholder:text-ink-3 ${expanded ? "flex-1" : "w-0 flex-none"}`}
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
        {/*
          `.lbl` 의 자간(0.14em ≈ 1.75px)은 **마지막 글자 뒤에도 붙는다.** 좌우 여백을 같게 줘도
          오른쪽만 그만큼 넓어 보여서, 그 몫을 당겨 눈에 대칭으로 맞춘다 (S15P21A405-649)
        */}
        <span className={`lbl -mr-[1.75px] shrink-0 ${expanded ? "" : "max-tablet:hidden"}`}>search</span>
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
