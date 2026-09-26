"use client";

import { useState } from "react";
import { useDrill } from "@/hooks/use-drill";
import EmptyState from "@/components/common/empty-state";
import IconButton from "@/components/common/icon-button";
import { CloseIcon } from "@/components/common/icons";
import PlaylistRow from "@/components/common/playlist-row";
import SkeletonRows from "@/components/common/skeleton-rows";
import { useDeletePlaylistMutation } from "@/hooks/mutations/use-delete-playlist-mutation";
import { useLikedPlaylistsQuery } from "@/hooks/queries/use-liked-playlists-query";
import { useMyPlaylistsQuery } from "@/hooks/queries/use-my-playlists-query";
import Button from "@/components/common/button";
import CreatePlaylistDialog from "../playlist/create-playlist-dialog";

interface FeedPlaylistsProps {
  /** 목록 주인. `isMe` 면 안 본다 — 그때는 토큰 주체로 부르는 편이 다른 화면과 캐시를 함께 쓴다 */
  email: string | null;
  isMe: boolean;
  /** 만든 것인가, 좋아요한 것인가 — 탭 하나에 한 종류 (S15P21A405-662) */
  kind: "made" | "liked";
}

/**
 * 피드의 플레이리스트 목록 (S15P21A405-524).
 *
 * **남의 피드에도 뜬다** (S15P21A405-587). USER-04 가 상대 프로필을 "마이페이지와 레이아웃
 * 동일" 로 정해 두었는데 이 목록만 내 페이지에 갇혀 있었다. 백엔드는 처음부터 이메일로
 * 아무나 조회하는 API 였고(`/api/playlist/search?email=`), 우리 쪽이 토큰 주체로 박아 뒀다.
 *
 * **남의 것은 읽기 전용이다.** 만들기 폼과 삭제 버튼은 내 페이지에만 붙는다 — 삭제는 줄마다
 * "내가 만든 것인가" 로도 갈리는데, 남의 피드에서는 그 값이 **그 사람이 만든 것**이라는 뜻이라
 * 그대로 두면 남의 플리에 삭제 버튼이 달린다.
 *
 * **만든 것과 좋아요한 것은 탭이 가른다** (S15P21A405-662). 한때 한 목록으로 이었다가(587) 기획이 탭으로
 * 나누기로 했다 — 이 컴포넌트는 `kind` 하나만 그린다. 만들기 폼은 "내 플리" 탭에만 선다.
 *
 * **삭제는 내 것에만 붙는다** — 좋아요한 남의 플리를 여기서 지울 수는 없다.
 *
 * `좋아요한 곡` 플리 자리는 비워 뒀다. **곡 좋아요 기능이 아직 없다** (배포 API 에 플리
 * 좋아요만 있고 곡 좋아요는 없다) — 생기면 이 목록 맨 앞에 한 줄 끼우면 된다.
 */
export default function FeedPlaylists({ email, isMe, kind }: FeedPlaylistsProps) {
  /**
   * 내 페이지에서는 **이메일을 안 넘긴다.** 그러면 플리 추가 메뉴·플리 패널이 쓰는 것과 같은
   * 캐시 자리(`["playlist","mine",null]`)를 함께 쓰고, 만들기·삭제 무효화도 예전 그대로 닿는다.
   */
  const target = isMe ? null : email;
  const made = kind === "made";
  // 둘 다 같은 캐시 자리를 쓰는 훅이라 함께 부른다 — 탭을 오가도 다시 받지 않는다
  const mine = useMyPlaylistsQuery(target);
  const liked = useLikedPlaylistsQuery(target);
  // 탭 화면에서는 지도로 돌아가서 연다 (S15P21A405-666)
  const drill = useDrill();
  const remove = useDeletePlaylistMutation();
  // 새 플리 만들기는 화면 가운데 팝업이다 (S15P21A405-686) — 목록 위에 늘 펼쳐 둔 폼이었다
  const [creating, setCreating] = useState(false);

  const query = made ? mine : liked;
  const rows = query.data ?? [];
  const empty = made ? (isMe ? "아직 만든 플레이리스트가 없어요. 위 버튼으로 하나 만들어 보세요." : "아직 만든 플레이리스트가 없어요.") : "아직 좋아요한 플레이리스트가 없어요.";

  return (
    <div className="flex flex-col gap-2">
      {isMe && made && (
        <Button size="sm" className="self-start" onClick={() => setCreating(true)}>
          ＋ 새 플레이리스트
        </Button>
      )}
      {creating && <CreatePlaylistDialog onClose={() => setCreating(false)} />}
      <div className="-mx-1.5 flex flex-col gap-0.5">
        {query.isPending && <SkeletonRows count={4} />}
        {!query.isPending && rows.length === 0 && <EmptyState message={empty} />}
        {rows.map((playlist) => (
          <PlaylistRow
            key={playlist.id}
            playlist={playlist}
            onClick={() => drill({ panel: "playlist", playlistId: playlist.id })}
            actions={
              // 삭제는 **내가 만든 것**에만 — 남의 피드의 "만든 것" 은 그 사람 것이다
              isMe && made ? (
                <IconButton
                  label="삭제"
                  size={26}
                  disabled={remove.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    remove.mutate(playlist.id);
                  }}
                >
                  <CloseIcon size={15} />
                </IconButton>
              ) : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
