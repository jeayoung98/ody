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
  /** `lg` 는 주변 사람 목록용 — 아바타 36, 글자 한 단계 큼 (S15P21A405-633). 랭킹·팔로우 목록은 기본 */
  size?: "md" | "lg";
}

/** .item — 프로필 한 줄 (주변친구 / 랭킹 목록 공용) */
export default function UserRow({ nickname, imageUrl, online = null, caption, prefix, right, actions, onClick, size = "md" }: UserRowProps) {
  const lg = size === "lg";
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
      {prefix != null && <span className="num w-4 shrink-0 text-right text-[11.5px] text-ink-4">{prefix}</span>}
      <Avatar src={imageUrl} name={nickname} size={lg ? 36 : 30} online={online} />
      <div className="min-w-0 flex-1">
        <p className={`truncate leading-[1.3] ${lg ? "text-[15px]" : "text-sm"}`}>{nickname ?? "익명"}</p>
        {caption && <p className={`truncate text-ink-3 ${lg ? "text-[13px]" : "text-xs"}`}>{caption}</p>}
      </div>
      {right != null && <span className={`num shrink-0 text-ink-3 ${lg ? "text-[12.5px]" : "text-[11.5px]"}`}>{right}</span>}
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}
