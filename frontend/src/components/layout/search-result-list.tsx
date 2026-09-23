"use client";

import { genreColor } from "@/constants/design-tokens";
import { useLoadMoreOnBottom } from "@/hooks/use-load-more-on-bottom";
import type { MusicSearchResult, SearchCondition } from "@/types";

interface SearchResultListProps {
  /** 지금 묻고 있는 조건. 안내 문구와 전환 동작이 여기서 갈린다 */
  condition: SearchCondition;
  /** 아직 조건으로 굳지 않은 입력값. 전환 동작의 대상이다 */
  input: string;
  results: MusicSearchResult[];
  /**
   * 조회가 **끝나서 결과가 비었다**는 것을 아는가.
   *
   * "없다" 와 "아직 모른다" 를 가르는 값이다. 로딩 플래그로 가르면 재시도가 멈춰 있거나
   * (오프라인 판정 등) 쿼리가 꺼져 있을 때도 "일치하는 음악이 없습니다" 가 떠서, 서버에
   * 닿지도 못한 것을 결과가 없는 것으로 읽게 된다.
   */
  isSuccess: boolean;
  /** 요청이 실패했는가. **빈 결과와 같은 화면으로 처리하지 않는다** (전달 문서 §2.3) */
  isError: boolean;
  onRetry: () => void;
  onSelect: (r: MusicSearchResult) => void;
  /** 입력값을 조건으로 굳힌다 */
  onPromote: (kind: "artist" | "music") => void;
  /** 더 받을 페이지가 남았는가 */
  hasMore: boolean;
  /** 지금 다음 페이지를 받는 중인가 */
  isLoadingMore: boolean;
  /**
   * 어디에 놓이는가 (S15P21A405-417).
   *
   * `dropdown` (기본) — 지도 위 검색 알약 아래로 떨어지는 떠 있는 상자. 유리·모서리·높이 제한이 있다.
   * `page` — 검색 전용 화면(`/search`). **상자가 아니라 그냥 목록이다** — 화면이 이미 제 상자라
   * 유리를 한 겹 더 씌우면 페이지 안에 드롭다운이 떠 있는 꼴이 된다. 높이도 화면이 정한다.
   */
  variant?: "dropdown" | "page";
  /** 바닥에 닿으면 부른다. 중복 호출 방지는 호출하는 쪽(useInfiniteQuery)이 한다 */
  onLoadMore: () => void;
}

/** 지금 무엇을 찾고 있는지 한 줄로 알려 준다 (전달 문서 §2.3) */
function heading(c: SearchCondition): string {
  if (c.mode === "all") return "음악 또는 아티스트 검색 결과";
  if (c.mode === "artist") return c.music ? `${c.artist}의 “${c.music}” 음악` : `${c.artist}의 음악`;
  return c.artist ? `“${c.music}” 제목의 ${c.artist} 음악` : `“${c.music}” 제목의 음악`;
}

/** #results .res — 바닥에 닿으면 다음 페이지를 이어 붙인다 (SEARCH-01) */
export default function SearchResultList({
  condition,
  input,
  results,
  isSuccess,
  isError,
  onRetry,
  onSelect,
  onPromote,
  hasMore,
  isLoadingMore,
  onLoadMore,
  variant = "dropdown",
}: SearchResultListProps) {
  const { boxRef, onScroll } = useLoadMoreOnBottom({ hasMore, isLoadingMore, count: results.length, onLoadMore });

  /** 통합 검색 상태에서만 조건을 굳힐 수 있다. 이미 칩이 있으면 두 번째 칩은 만들지 않는다 */
  const canPromote = condition.mode === "all" && input.length > 0;
  return (
    <div
      ref={boxRef}
      onScroll={onScroll}
      // 스크롤바를 잡아도 검색창이 포커스를 잃지 않게 (잃으면 목록이 닫힌다)
      onMouseDown={(e) => e.preventDefault()}
      className={variant === "page" ? "pt-1" : "glass mt-[7px] max-h-[46vh] overflow-y-auto rounded-[15px]!"}
    >
      {/* 통합 검색에서 입력값을 제목 또는 아티스트 조건으로 굳힌다. */}
      {canPromote && (
        <div className="border-b border-white/[.08]">
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onPromote("artist")} className={ACTION_CLASS}>
            <span className="truncate">“{input}”를 아티스트로 검색</span>
            <span className="shrink-0 text-ink-4">›</span>
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onPromote("music")} className={ACTION_CLASS}>
            <span className="truncate">“{input}”를 제목으로 검색</span>
            <span className="shrink-0 text-ink-4">›</span>
          </button>
        </div>
      )}

      <p className="px-[13px] pt-[9px] pb-1 text-[13px] text-ink-4">{heading(condition)}</p>

      {isError ? (
        /* 빈 결과와 실패를 같은 화면으로 처리하지 않는다 — 다시 눌러 볼 수 있어야 한다 */
        <div className="flex items-center justify-between gap-2 px-[13px] py-[9px]">
          <span className="text-xs text-ink-3">검색하지 못했습니다. 다시 시도해 주세요.</span>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onRetry} className="shrink-0 cursor-pointer text-xs text-teal hover:underline">
            재시도
          </button>
        </div>
      ) : results.length === 0 ? (
        /* 끝난 뒤에만 "없다" 고 말한다 — 그 전에는 아직 모르는 것이다 */
        <p className="px-[13px] py-[9px] text-xs text-ink-3">{isSuccess ? "일치하는 음악이 없습니다." : "검색 중..."}</p>
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
                  <span className="block truncate text-[14.5px] leading-[1.3]">{r.title}</span>
                  <span className="block truncate text-[13px] text-ink-3">{r.artist ?? "-"}</span>
                </span>
              </button>
            );
          })}
          {/* 한 페이지에 20초 가까이 걸린다 — 멈춘 것처럼 보이지 않게 바닥에 상태를 남긴다 */}
          {isLoadingMore && <p className="px-[13px] py-[9px] text-center text-[13px] text-ink-3">다음 10곡 불러오는 중...</p>}
          {!hasMore && !isLoadingMore && <p className="px-[13px] py-[9px] text-center text-[13px] text-ink-4">결과 끝</p>}
        </>
      )}
    </div>
  );
}

const ACTION_CLASS =
  "flex w-full cursor-pointer items-center justify-between gap-2 px-[13px] py-[9px] text-left text-[14px] text-ink-2 transition-colors hover:bg-white/[.06]";
