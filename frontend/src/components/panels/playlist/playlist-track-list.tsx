"use client";

import EmptyState from "@/components/common/empty-state";
import IconButton from "@/components/common/icon-button";
import { CloseIcon, PlayIcon } from "@/components/common/icons";
import SectionTitle from "@/components/common/section-title";
import TrackRow from "@/components/common/track-row";
import { useRemovePlaylistItemMutation } from "@/hooks/mutations/use-remove-playlist-item-mutation";
import { usePanelStore } from "@/stores/use-panel-store";
import { usePlayerStore } from "@/stores/use-player-store";
import { useStartActivity } from "@/hooks/use-start-activity";
import type { PlaylistDetail } from "@/types";

interface PlaylistTrackListProps {
  playlist: PlaylistDetail;
  /** 내 플리면 삭제 가능 */
  editable: boolean;
}

/** 곡 목록 컴포넌트 (숫자 버전) */
export default function PlaylistTrackList({ playlist, editable }: PlaylistTrackListProps) {
  const currentMusicId = usePlayerStore((s) => s.currentMusicId);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const openSong = usePanelStore((s) => s.openSong);
  const remove = useRemovePlaylistItemMutation();
  const startActivity = useStartActivity();

  const ids = playlist.items.map((it) => it.musicId);

  return (
    <div className="flex flex-col gap-2">
      <SectionTitle aside={`${playlist.itemCount}곡`}>곡 목록</SectionTitle>
      {playlist.items.length === 0 ? (
        <EmptyState message="아직 담은 곡이 없습니다. 지도에서 곡을 고르고 ＋ 플리 를 누르세요." />
      ) : (
        <div className="-mx-1.5 flex flex-col gap-0.5">
          {playlist.items.map((it, i) => (
            <TrackRow
              key={it.musicId}
              index={i + 1}
              title={it.music.title}
              artist={it.music.artist}
              duration={it.music.duration}
              active={it.musicId === currentMusicId}
              onClick={() => openSong(it.musicId)}
              actions={
                <>
                  <IconButton
                    label="이 곡부터 재생"
                    size={26}
                    onClick={(e) => {
                      e.stopPropagation();
                      startActivity("playlist", String(playlist.id), () => playQueue({ kind: "playlist", playlistId: playlist.id }, ids, i));
                    }}
                  >
                    <PlayIcon size={13} />
                  </IconButton>
                  {editable && (
                    <IconButton
                      label="삭제"
                      size={26}
                      disabled={remove.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        remove.mutate({ playlistId: playlist.id, musicId: it.musicId });
                      }}
                    >
                      <CloseIcon size={13} />
                    </IconButton>
                  )}
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
