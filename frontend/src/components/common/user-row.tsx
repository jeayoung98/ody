import type { ReactNode } from "react";
import Avatar from "./avatar";

interface UserRowProps {
  nickname: string | null;
  imageUrl: string | null;
  online?: boolean | null;
  /** 닉네임 아래 보조 문구 ("루나를 따라가는 중" 등) */
  caption?: string | null;
  /**
   * 왼쪽 동그란 사진 자리를 통째로 갈아 끼운다 (S15P21A405-536). 주변 사람 줄은 지도와 같은
   * 우주 헬멧을 쓴다 — 목록과 지도가 다른 그림이면 목록에서 본 사람을 지도에서 못 찾는다.
   */
  avatar?: ReactNode;
  /** 앞에 붙는 순위 등 */
  prefix?: ReactNode;
  /** 우측 모노 텍스트 (점수 등) */
  right?: ReactNode;
  actions?: ReactNode;
  onClick?: () => void;
}

/** .item — 프로필 한 줄 (주변친구 / 랭킹 목록 공용) */
export default function UserRow({ nickname, imageUrl, online = null, avatar, caption, prefix, right, actions, onClick }: UserRowProps) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      className={`flex w-full items-center gap-2.5 rounded-box-sm border border-transparent px-[9px] py-2 text-left transition-colors duration-fast ${
        onClick ? "cursor-pointer hover:border-line hover:bg-white/[.055]" : ""
      }`}
    >
      {prefix != null && <span className="num w-4 shrink-0 text-right text-[10px] text-ink-4">{prefix}</span>}
      {avatar ?? <Avatar src={imageUrl} name={nickname} size={30} online={online} />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm leading-[1.3]">{nickname ?? "익명"}</p>
        {caption && <p className="truncate text-xs text-ink-3">{caption}</p>}
      </div>
      {right != null && <span className="num shrink-0 text-[10px] text-ink-3">{right}</span>}
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}
