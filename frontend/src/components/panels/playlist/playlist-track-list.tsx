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
  const openSong = usePanelStore((s) => s.openSongFromList);
  const remove = useRemovePlaylistItemMutation();
  const startActivity = useStartActivity();

  const ids = playlist.items.map((it) => it.musicId);

  /**
   * 곡을 고르면 **그 곡부터 플리를 듣는다.** 행 옆 `이 곡부터 재생` 버튼과 같은 동작이다 —
   * 목록을 눌렀는데 상세만 뜨고 소리는 그대로면 눌린 건지 알 수 없다.
   *
   * 단일 재생이 아니라 플리 재생이다. 다른 활동이 돌고 있으면 먼저 확인을 받는다 (ACT-01).
   */
  const playFrom = (index: number) =>
    startActivity("playlist", String(playlist.id), () => playQueue({ kind: "playlist", playlistId: playlist.id }, ids, index));

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
              onClick={() => {
                openSong(it.musicId);
                playFrom(i);
              }}
              actions={
                <>
                  <IconButton
                    label="이 곡부터 재생"
                    size={26}
                    onClick={(e) => {
                      e.stopPropagation();
                      playFrom(i);
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
