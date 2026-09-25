"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { CloseIcon, SearchIcon } from "@/components/common/icons";
import { ROUTES } from "@/constants";
import { CHIP_LABEL, useMusicSearch } from "@/hooks/use-music-search";
import type { MusicSearchResult } from "@/types";
import SearchResultList from "./search-result-list";

/**
 * 검색 전용 화면 (SEARCH-01, S15P21A405-417). **좁은 화면에서만 온다.**
 *
 * 지도 위 드롭다운은 375px 에서 결과가 서너 줄밖에 안 보였다. 여기는 화면을 통째로 쓰므로
 * 결과가 끝까지 보이고, 다음 10곡 이어 붙이기도 스크롤로 자연스럽게 된다.
 *
 * 곡을 고르면 **지도로 돌아간다** — 검색은 지도를 움직이러 온 것이고, 고른 순간 그 일이
 * 끝난다. 상세 패널을 여는 것과 좌표로 날아가는 것은 `useMusicSearch` 의 `select` 가 한다.
 */
export default function SearchScreen() {
  const router = useRouter();
  const { input, setInput, chip, inputRef, condition, results, query, select, promote, removeChip, analytics } =
    useMusicSearch({ visible: true, source: "search_page" });
  const { isSuccess, isError, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  // 들어오자마자 키보드가 올라오게 한다 — 검색하러 온 화면이다
  useEffect(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  const leave = () => router.push(ROUTES.home);

  const handleSelect = (r: MusicSearchResult) => {
    select(r);
    leave();
  };

  return (
    /*
      아래는 **재생바 위에서 끝난다** (S15P21A405-417, `--nav-bottom`). 예전에는 화면을 통째로
      덮었는데, 그러면 검색하는 동안 듣던 곡이 화면에서 사라지고 — 이 화면이 앱 셸 밖에 있던
      시절에는 유튜브 임베드까지 같이 떨어져 **음악이 끊겼다.** 지금은 셸 안이라 지도도 재생도
      살아 있고, 재생바와 탭바는 그대로 아래에 보인다.
    */
    <main className="stage-bg fixed inset-x-0 top-0 bottom-[var(--nav-bottom)] z-[22] flex flex-col">
      <header className="flex items-center gap-2 px-gutter-sm pt-hud-t pb-2">
        <div className="glass-liquid flex h-11 min-w-0 flex-1 items-center gap-[9px] rounded-pill! pr-3 pl-[15px]">
          <SearchIcon className="shrink-0 opacity-50" />
          {chip && (
            <span className="flex shrink-0 items-center gap-1 rounded-pill bg-white/[.08] py-0.5 pr-1 pl-2 text-[13.5px] whitespace-nowrap text-ink-2">
              {CHIP_LABEL[chip.kind]}: {chip.value}
              <button
                type="button"
                aria-label={`${CHIP_LABEL[chip.kind]} 조건 제거`}
                onClick={removeChip}
                className="cursor-pointer rounded-pill p-0.5 text-ink-3 transition-colors hover:text-ink"
              >
                <CloseIcon size={12} />
              </button>
            </span>
          )}
          <input
            ref={inputRef}
            className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-3"
            placeholder={chip ? (chip.kind === "artist" ? "제목 검색..." : "아티스트 검색...") : "음악 · 아티스트 검색"}
            autoComplete="off"
            spellCheck={false}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // 입력이 빈 상태의 Backspace 는 칩을 지운다 — 칩도 지워 나가는 글자처럼 다룬다
              if (e.key === "Backspace" && !input && chip) {
                e.preventDefault();
                removeChip();
              }
            }}
          />
        </div>
        <button
          type="button"
          onClick={leave}
          className="h-touch shrink-0 px-1 text-[15px] text-ink-2 transition-colors hover:text-ink"
        >
          닫기
        </button>
      </header>

      {/* 아직 아무것도 안 쳤을 때는 결과 상자를 띄우지 않는다 — 빈 상자가 고장처럼 보인다 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-gutter-sm pb-hud-b">
        {(chip || input.trim()) && (
          <SearchResultList
            variant="page"
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
        {!chip && !input.trim() && (
          <p className="pt-10 text-center text-[14.5px] leading-[1.7] text-ink-3">
            곡 제목이나 아티스트를 입력해 보세요
            <br />
            고른 곡은 지도에서 찾아 줍니다
          </p>
        )}
      </div>
    </main>
  );
}
