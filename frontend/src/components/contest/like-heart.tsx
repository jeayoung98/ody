import type { ContestEntry } from "@/types";

interface LikeHeartProps {
  entry: ContestEntry;
  disabled: boolean;
  title: string;
  onClick: () => void;
}

/**
 * 작품 좋아요 — 테두리 없이 하트와 숫자만 붙여서 (S15P21A405-702). 상자 버튼에 넣으면 카드 안에 카드가 또 있는 것처럼
 * 보였다. 갤러리 카드와 순위 시상대가 같이 쓴다. 누른 상태는 하트를 채우고 붉게.
 */
export default function LikeHeart({ entry, disabled, title, onClick }: LikeHeartProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={`flex items-center gap-0.5 px-1 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${entry.likedByMe ? "text-bad" : "text-ink-2 hover:text-ink"}`}
    >
      <span aria-hidden>{entry.likedByMe ? "♥" : "♡"}</span>
      <span className="num text-xs">{entry.likeCnt}</span>
    </button>
  );
}
