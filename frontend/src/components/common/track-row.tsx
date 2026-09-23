import type { ReactNode } from "react";
import { formatDuration } from "@/lib/format";

interface TrackRowProps {
  title: string;
  artist: string | null;
  /** 앞에 붙는 번호. 없으면 표시 안 함 (숫자 버전 / 일반 버전) */
  index?: number;
  duration?: number | null;
  /** 보조 텍스트 (장르 등) */
  meta?: string | null;
  /** 우측 모노 텍스트 (재생수, 유사도 등). duration 보다 우선 */
  right?: ReactNode;
  /** 현재 재생 중/선택 강조 */
  active?: boolean;
  /** 앞에 붙는 색 점 (장르 색) */
  dotColor?: string;
  /** 우측 액션 (추가/삭제 버튼 등) */
  actions?: ReactNode;
  onClick?: () => void;
}

/**
 * .item — 곡 한 줄 컴포넌트. 플레이리스트/여정/가까운 곡 목록 등에 공통 사용.
 * 줄 전체가 `group` 이라 `actions` 는 `group-hover:` 로 호버에만 드러낼 수 있다.
 */
export default function TrackRow({ title, artist, index, duration, meta, right, active = false, dotColor, actions, onClick }: TrackRowProps) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      // 안의 액션 버튼에서 올라온 Enter 까지 줄 클릭으로 세면, 재생 버튼 하나에 상세까지 같이 열린다
      onKeyDown={onClick ? (e) => e.target === e.currentTarget && e.key === "Enter" && onClick() : undefined}
      className={`group flex w-full items-center gap-2.5 rounded-box-sm border px-[9px] py-2 text-left transition-colors duration-fast ${
        active ? "border-teal/30 bg-teal/[.08]" : "border-transparent"
      } ${onClick ? "cursor-pointer hover:border-line hover:bg-white/[.055]" : ""}`}
    >
      {index != null && <span className="num w-4 shrink-0 text-right text-[11.5px] text-ink-4">{index}</span>}
      {dotColor && <span className="h-[7px] w-[7px] shrink-0 rounded-pill" style={{ background: dotColor, boxShadow: `0 0 8px ${dotColor}` }} />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm leading-[1.3]">{title}</p>
        <p className="truncate text-xs text-ink-3">
          {artist ?? "Unknown"}
          {meta ? ` · ${meta}` : ""}
        </p>
      </div>
      {right != null ? (
        <span className="num shrink-0 text-right text-[11.5px] leading-[1.45] text-ink-3">{right}</span>
      ) : duration != null ? (
        <span className="num shrink-0 text-[11.5px] text-ink-3">{formatDuration(duration)}</span>
      ) : null}
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}
