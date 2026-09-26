import IconButton from "@/components/common/icon-button";
import { PlaylistAddIcon } from "@/components/common/icons";

interface SaveToPlaylistButtonProps {
  /** 이미 내 플리로 넣었다 — 꺼진 채 남는다. 같은 작품을 두 번 넣으면 같은 플리가 둘 생긴다 */
  saved: boolean;
  pending: boolean;
  /** 담을 곡이 없다(좌표만 남은 작품) */
  empty: boolean;
  onClick: () => void;
}

/**
 * 작품을 내 플리로 가져오는 아이콘 버튼 (S15P21A405-702). 곡 상세의 "플레이리스트에 추가" 와 같은 아이콘이다 —
 * 같은 일을 하는 버튼은 어디서든 같게 생겨야 한다. 순위 시상대와 목록이 같이 쓴다.
 */
export default function SaveToPlaylistButton({ saved, pending, empty, onClick }: SaveToPlaylistButtonProps) {
  return (
    <IconButton label={saved ? "내 플리에 넣었어요" : "내 플리로 가져오기"} active={saved} disabled={saved || pending || empty} onClick={onClick} className="disabled:opacity-45">
      <PlaylistAddIcon size={17} />
    </IconButton>
  );
}
