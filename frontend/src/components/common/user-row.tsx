import type { ReactNode } from "react";
import Avatar from "./avatar";

interface UserRowProps {
  nickname: string | null;
  imageUrl: string | null;
  online?: boolean | null;
  /** 닉네임 아래 보조 문구 ("루나를 따라가는 중" 등) */
  caption?: string | null;
  /** 앞에 붙는 순위 등 */
  prefix?: ReactNode;
  /** 우측 모노 텍스트 (점수 등) */
  right?: ReactNode;
  actions?: ReactNode;
  onClick?: () => void;
}

/**
 * .item — 프로필 한 줄 (주변친구 / 랭킹 / 팔로우 목록 공용).
 *
 * 크기는 하나다. 633 에서 주변 사람만 `lg` 로 키웠다가, 랭킹·팔로우도 작다는 확인이 있어
 * 그 크기를 모두의 기본으로 올리고 옵션을 없앴다 (S15P21A405-637).
 */
export default function UserRow({ nickname, imageUrl, online = null, caption, prefix, right, actions, onClick }: UserRowProps) {
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
      {prefix != null && <span className="num w-5 shrink-0 text-right text-[13.5px] text-ink-4">{prefix}</span>}
      <Avatar src={imageUrl} name={nickname} size={36} online={online} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] leading-[1.3]">{nickname ?? "익명"}</p>
        {caption && <p className="truncate text-[14px] text-ink-3">{caption}</p>}
      </div>
      {right != null && <span className="num shrink-0 text-[13.5px] text-ink-3">{right}</span>}
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}
