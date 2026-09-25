import type { ReactNode } from "react";
import type { PlaylistSummary } from "@/types";

interface PlaylistRowProps {
  playlist: PlaylistSummary;
  actions?: ReactNode;
  onClick?: () => void;
}

/** .item — 플레이리스트 한 줄 (플리뷰 목록 항목) */
export default function PlaylistRow({ playlist, actions, onClick }: PlaylistRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-box-sm border border-transparent px-[9px] py-2 text-left transition-colors duration-fast hover:border-line hover:bg-white/[.055]"
    >
      <span
        className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] text-xs text-ink shadow-[inset_0_0_0_1px_rgba(255,255,255,.14)]"
        style={{ background: "linear-gradient(140deg,#12203c,#1b1330)" }}
      >
        ♪
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm leading-[1.3]">{playlist.playlistName}</p>
        <p className="truncate text-xs text-ink-3">
          {playlist.ownerNickname ?? "-"} · {playlist.itemCount}곡
        </p>
      </div>
      <span className="num shrink-0 text-[12.5px] text-ink-3">♥ {playlist.likeCnt ?? 0}</span>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}
