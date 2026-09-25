"use client";

import { useEffect, useRef } from "react";
import { CloseIcon } from "@/components/common/icons";
import { useMusicLabel } from "@/hooks/use-music-label";

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
  // 누를 때 넘겨받은 제목이 있으면 조회를 기다리지 않는다 (S15P21A405-585)
  const { title, artist } = useMusicLabel(musicId);
  const isStart = role === "start";
  const editing = active && keyword.length > 0;
  const inputRef = useRef<HTMLInputElement>(null);
  /**
   * **빈 칸이 차례가 되면 커서를 갖다 둔다** (S15P21A405-661). 출발점 ✕ 를 누르면 차례가 출발로 오는데
   * (`setStart(null)`), 눈에 보이는 점만 바뀌고 커서는 없어서 바로 검색어를 칠 수 없었다.
   * 채워진 칸이 차례가 될 때는 안 건드린다 — 지도에서 별을 눌러 채운 직후 키보드가 올라오면 안 된다(폰).
   */
  useEffect(() => {
    if (active && musicId == null) inputRef.current?.focus();
  }, [active, musicId]);
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
          ref={inputRef}
          className={`w-full bg-transparent text-[16px] outline-none ${musicId != null ? "placeholder:text-ink" : "placeholder:text-ink-4"}`}
          placeholder={musicId != null ? title : `${isStart ? "출발" : "도착"} 지점 검색`}
          value={active ? keyword : musicId != null ? title : ""}
          onFocus={onFocusSlot}
          onChange={(e) => onKeywordChange(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
      </span>
      {musicId != null && !editing && <span className="shrink-0 truncate text-[13.5px] text-ink-3">{artist}</span>}
      {musicId != null && !editing && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`${isStart ? "출발" : "도착"} 비우기`}
          className="shrink-0 text-ink-4 transition-colors hover:text-ink"
        >
          <CloseIcon size={14} />
        </button>
      )}
    </label>
  );
}
