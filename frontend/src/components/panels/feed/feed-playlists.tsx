"use client";

import EmptyState from "@/components/common/empty-state";
import IconButton from "@/components/common/icon-button";
import { CloseIcon } from "@/components/common/icons";
import PlaylistRow from "@/components/common/playlist-row";
import SkeletonRows from "@/components/common/skeleton-rows";
import { useDeletePlaylistMutation } from "@/hooks/mutations/use-delete-playlist-mutation";
import { useLikedPlaylistsQuery } from "@/hooks/queries/use-liked-playlists-query";
import { useMyPlaylistsQuery } from "@/hooks/queries/use-my-playlists-query";
import { usePanelStore } from "@/stores/use-panel-store";
import CreatePlaylistForm from "../playlist/create-playlist-form";

interface FeedPlaylistsProps {
  /** 목록 주인. `isMe` 면 안 본다 — 그때는 토큰 주체로 부르는 편이 다른 화면과 캐시를 함께 쓴다 */
  email: string | null;
  isMe: boolean;
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
 * **내 플리와 좋아요한 플리를 한 목록으로 잇는다.** 예전에는 소제목 붙은 두 섹션이었는데,
 * 둘 다 "내가 여는 플리" 라 나눌 이유가 약했고 제목·개수 표시가 줄마다 자리를 먹었다.
 * 누구 것인지는 줄 안에 만든 사람이 적혀 있어서(`playlist-row`) 굳이 갈라 놓지 않아도 읽힌다.
 *
 * **삭제는 내 것에만 붙는다** — 좋아요한 남의 플리를 여기서 지울 수는 없다.
 *
 * `좋아요한 곡` 플리 자리는 비워 뒀다. **곡 좋아요 기능이 아직 없다** (배포 API 에 플리
 * 좋아요만 있고 곡 좋아요는 없다) — 생기면 이 목록 맨 앞에 한 줄 끼우면 된다.
 */
export default function FeedPlaylists({ email, isMe }: FeedPlaylistsProps) {
  /**
   * 내 페이지에서는 **이메일을 안 넘긴다.** 그러면 플리 추가 메뉴·플리 패널이 쓰는 것과 같은
   * 캐시 자리(`["playlist","mine",null]`)를 함께 쓰고, 만들기·삭제 무효화도 예전 그대로 닿는다.
   */
  const target = isMe ? null : email;
  const mine = useMyPlaylistsQuery(target);
  const liked = useLikedPlaylistsQuery(target);
  const openPlaylist = usePanelStore((s) => s.openPlaylist);
  const remove = useDeletePlaylistMutation();

  const loading = mine.isPending || liked.isPending;
  /**
   * 만든 것을 앞에 둔다 — 만들자마자 목록 위에서 보이는 편이 자연스럽다.
   *
   * `made` 는 **목록 주인이 만든 것**이라는 뜻이다. 내 페이지에서는 그게 곧 "내 것" 이라
   * 삭제가 붙지만, 남의 피드에서는 아니다 — 그래서 삭제는 `isMe` 를 한 번 더 본다.
   */
  const rows = [
    ...(mine.data ?? []).map((playlist) => ({ playlist, made: true })),
    ...(liked.data ?? []).map((playlist) => ({ playlist, made: false })),
  ];

  return (
    <div className="flex flex-col gap-2">
      {isMe && <CreatePlaylistForm />}
      <div className="-mx-1.5 flex flex-col gap-0.5">
        {loading && <SkeletonRows count={4} />}
        {!loading && rows.length === 0 && <EmptyState message="아직 플레이리스트가 없어요." />}
        {rows.map(({ playlist, made: isMine }) => (
          <PlaylistRow
            key={`${isMine ? "m" : "l"}:${playlist.id}`}
            playlist={playlist}
            onClick={() => openPlaylist(playlist.id)}
            actions={
              isMe && isMine ? (
                <IconButton
                  label="삭제"
                  size={26}
                  disabled={remove.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    remove.mutate(playlist.id);
                  }}
                >
                  <CloseIcon size={13} />
                </IconButton>
              ) : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
