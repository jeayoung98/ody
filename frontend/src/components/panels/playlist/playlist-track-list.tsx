"use client";

import EmptyState from "@/components/common/empty-state";
import IconButton from "@/components/common/icon-button";
import { ChevronDownIcon, CloseIcon, PlayIcon } from "@/components/common/icons";
import SectionTitle from "@/components/common/section-title";
import TrackRow from "@/components/common/track-row";
import { useRemovePlaylistItemMutation } from "@/hooks/mutations/use-remove-playlist-item-mutation";
import { moveItem, useReorderPlaylistItemsMutation } from "@/hooks/mutations/use-reorder-playlist-items-mutation";
import { usePanelStore } from "@/stores/use-panel-store";
import { usePlayerStore } from "@/stores/use-player-store";
import { useStartActivity } from "@/hooks/use-start-activity";
import type { PlaylistDetail } from "@/types";

interface PlaylistTrackListProps {
  playlist: PlaylistDetail;
  /** 내 플리면 곡을 빼고 순서를 바꿀 수 있다 */
  editable: boolean;
}

/** 곡 목록 컴포넌트 (숫자 버전) */
export default function PlaylistTrackList({ playlist, editable }: PlaylistTrackListProps) {
  const currentMusicId = usePlayerStore((s) => s.currentMusicId);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const openSong = usePanelStore((s) => s.openSongFromList);
  const remove = useRemovePlaylistItemMutation();
  const reorder = useReorderPlaylistItemsMutation();
  const startActivity = useStartActivity();

  const ids = playlist.items.map((it) => it.musicId);

  /**
   * 한 칸 옮긴다 (S15P21A405-540). **바뀐 곡이 아니라 전체 순서를 보낸다** — 백엔드가 부분
   * 지시를 받지 않고 목록을 통째로 다시 매긴다.
   *
   * 보내는 중에도 다음 누름을 막지 않는다. 한 칸씩 여러 번 눌러 옮기는 것이 이 버튼을 쓰는
   * 방식이라, 왕복마다 잠그면 두 칸 옮기는 데 두 번을 기다려야 한다. 캐시는 이미 눌린 대로
   * 앞서 가 있으므로 다음 요청도 그 순서에서 출발한다.
   */
  const move = (from: number, to: number) => {
    const next = moveItem(ids, from, to);
    if (next === ids) return;
    reorder.mutate({ playlistId: playlist.id, musicIds: [...next] });
  };

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
                    <>
                      {/*
                        위·아래 한 칸씩 (S15P21A405-540). 끌어서 옮기는 것이 손에는 더 편하지만,
                        그러려면 포인터·터치·키보드를 전부 다시 짜야 한다. 버튼은 그 셋이 공짜로
                        따라오고 스크린리더에서도 읽힌다 — 끌기는 이게 부족할 때 얹는다.

                        **첫 곡의 위로와 마지막 곡의 아래로는 잠근다.** 눌러도 아무 일이 없으면
                        고장으로 보인다.
                      */}
                      <IconButton
                        label="위로 옮기기"
                        size={26}
                        disabled={i === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          move(i, i - 1);
                        }}
                      >
                        <ChevronDownIcon size={13} className="rotate-180" />
                      </IconButton>
                      <IconButton
                        label="아래로 옮기기"
                        size={26}
                        disabled={i === playlist.items.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          move(i, i + 1);
                        }}
                      >
                        <ChevronDownIcon size={13} />
                      </IconButton>
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
                    </>
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
