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

/**
 * 마이페이지의 플레이리스트 목록 (S15P21A405-524).
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
export default function FeedPlaylists() {
  const mine = useMyPlaylistsQuery();
  const liked = useLikedPlaylistsQuery();
  const openPlaylist = usePanelStore((s) => s.openPlaylist);
  const remove = useDeletePlaylistMutation();

  const loading = mine.isPending || liked.isPending;
  /** 내 것을 앞에 둔다 — 만들자마자 목록 위에서 보이는 편이 자연스럽다 */
  const rows = [
    ...(mine.data ?? []).map((playlist) => ({ playlist, mine: true })),
    ...(liked.data ?? []).map((playlist) => ({ playlist, mine: false })),
  ];

  return (
    <div className="flex flex-col gap-2">
      <CreatePlaylistForm />
      <div className="-mx-1.5 flex flex-col gap-0.5">
        {loading && <SkeletonRows count={4} />}
        {!loading && rows.length === 0 && <EmptyState message="아직 플레이리스트가 없어요." />}
        {rows.map(({ playlist, mine: isMine }) => (
          <PlaylistRow
            key={`${isMine ? "m" : "l"}:${playlist.id}`}
            playlist={playlist}
            onClick={() => openPlaylist(playlist.id)}
            actions={
              isMine ? (
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
