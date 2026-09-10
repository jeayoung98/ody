"use client";

import { CloseIcon } from "@/components/common/icons";
import { useMusicDetailQuery } from "@/hooks/queries/use-music-detail-query";

interface JourneyComposerSlotProps {
  role: "start" | "end";
  musicId: number | null;
  /** 이 칸을 편집 중인가 (입력 포커스 + 지도 클릭이 채울 칸) */
  active: boolean;
  /** 편집 중일 때의 검색어 */
  keyword: string;
  onFocusSlot: () => void;
  onKeywordChange: (v: string) => void;
  onClear: () => void;
}

/**
 * 여정 확장 검색의 출발(A)·도착(B) 줄. **줄 자체가 검색 입력창**이다 (JOURNEY-01).
 * 테두리 없이 점 하나와 입력만 두고, 편집 중인 줄만 색이 살아난다.
 */
export default function JourneyComposerSlot({ role, musicId, active, keyword, onFocusSlot, onKeywordChange, onClear }: JourneyComposerSlotProps) {
  const { data } = useMusicDetailQuery(musicId);
  const isStart = role === "start";
  const title = data?.title ?? (musicId != null ? `Track ${musicId}` : "");
  const editing = active && keyword.length > 0;
  const dot = isStart
    ? active
      ? "bg-teal shadow-[0_0_9px_#4fe3ce]"
      : "bg-teal/45"
    : active
      ? "bg-violet shadow-[0_0_9px_#a67cff]"
      : "bg-violet/45";

  return (
    <label className="flex cursor-text items-center gap-3 py-2.5">
      <span className={`h-[7px] w-[7px] shrink-0 rounded-pill transition-all duration-fast ${dot}`} />
      <span className="min-w-0 flex-1">
        <input
          className={`w-full bg-transparent text-[14px] outline-none ${musicId != null ? "placeholder:text-ink" : "placeholder:text-ink-4"}`}
          placeholder={musicId != null ? title : `${isStart ? "출발" : "도착"} 지점 검색`}
          value={active ? keyword : musicId != null ? title : ""}
          onFocus={onFocusSlot}
          onChange={(e) => onKeywordChange(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
      </span>
      {musicId != null && !editing && <span className="shrink-0 truncate text-[11.5px] text-ink-3">{data?.artist}</span>}
      {musicId != null && !editing && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`${isStart ? "출발" : "도착"} 비우기`}
          className="shrink-0 text-ink-4 transition-colors hover:text-ink"
        >
          <CloseIcon size={12} />
        </button>
      )}
    </label>
  );
}
