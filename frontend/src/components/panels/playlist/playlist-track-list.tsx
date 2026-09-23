"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import EmptyState from "@/components/common/empty-state";
import IconButton from "@/components/common/icon-button";
import { CloseIcon, PlayIcon } from "@/components/common/icons";
import SectionTitle from "@/components/common/section-title";
import { useRemovePlaylistItemMutation } from "@/hooks/mutations/use-remove-playlist-item-mutation";
import { moveItem, useReorderPlaylistItemsMutation } from "@/hooks/mutations/use-reorder-playlist-items-mutation";
import { rememberMusicHints } from "@/lib/music-hints";
import { usePanelStore } from "@/stores/use-panel-store";
import { usePlayerStore } from "@/stores/use-player-store";
import { usePlayPlaylist } from "@/hooks/use-play-playlist";
import type { PlaylistDetail } from "@/types";
import PlaylistSortableRow from "./playlist-sortable-row";

interface PlaylistTrackListProps {
  playlist: PlaylistDetail;
  /** 내 플리면 곡을 빼고 순서를 바꿀 수 있다 */
  editable: boolean;
}

/**
 * 곡 목록 (숫자 버전). 내 플리면 **손잡이를 잡고 끌어** 순서를 바꾼다 (S15P21A405-540).
 *
 * 순서가 바뀌면 **눌린 즉시 화면에 반영된다.** 서버를 다녀온 뒤에 그리면 놓은 줄이 원래 자리로
 * 돌아갔다가 뒤늦게 다시 옮겨 가는 것이 보인다. 되돌리는 일은 요청이 실패했을 때만 일어난다
 * (`use-reorder-playlist-items-mutation` 의 `onMutate`·`onError`).
 */
export default function PlaylistTrackList({ playlist, editable }: PlaylistTrackListProps) {
  const currentMusicId = usePlayerStore((s) => s.currentMusicId);
  const openSong = usePanelStore((s) => s.openSongFromList);
  const remove = useRemovePlaylistItemMutation();
  const reorder = useReorderPlaylistItemsMutation();
  const playPlaylist = usePlayPlaylist(playlist);

  const ids = playlist.items.map((it) => it.musicId);

  /**
   * **누르기와 끌기를 가른다.** 손잡이를 그냥 누르기만 해도 끌기로 잡히면 초점이 튀고 화면이
   * 흔들린다. 4px 은 손가락이 떨리는 정도는 누르기로, 옮기려는 움직임은 끌기로 갈라 준다.
   *
   * 키보드 감지기를 같이 단다. 버튼 두 개를 손잡이 하나로 바꾸면서 **키보드로 순서를 못 바꾸게
   * 되는 것**이 유일한 손실이었는데, 이 한 줄이 그 자리를 메운다 —
   * 손잡이에서 스페이스로 집고 화살표로 옮긴다.
   */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /**
   * 놓았다. **바뀐 곡이 아니라 새 순서 전체를 보낸다** — 백엔드가 부분 지시를 받지 않고
   * `musicIdList` 를 통째로 다시 매긴다.
   */
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const next = moveItem(ids, ids.indexOf(Number(active.id)), ids.indexOf(Number(over.id)));
    if (next === ids) return;
    reorder.mutate({ playlistId: playlist.id, musicIds: [...next] });
  };

  /**
   * 곡을 고르면 **그 곡부터 플리를 듣는다.** 행 옆 `이 곡부터 재생` 버튼과 같은 동작이다 —
   * 목록을 눌렀는데 상세만 뜨고 소리는 그대로면 눌린 건지 알 수 없다.
   *
   * 단일 재생이 아니라 플리 재생이다. 다른 활동이 돌고 있으면 먼저 확인을 받는다 (ACT-01).
   */
  const playFrom = (index: number) => {
    // 목록이 이미 들고 있는 제목·아티스트다 — 큐 전체를 넘겨 재생바가 기다리지 않게 한다 (S15P21A405-585)
    rememberMusicHints(playlist.items.map((it) => it.music));
    // 별자리 뷰도 함께 켠다 (S15P21A405-613) — 머리글의 `순차 재생` 과 시작 위치만 다른 한 동작이다
    playPlaylist(index);
  };

  return (
    <div className="flex flex-col gap-2">
      <SectionTitle aside={`${playlist.itemCount}곡`}>곡 목록</SectionTitle>
      {playlist.items.length === 0 ? (
        <EmptyState message="아직 담은 곡이 없습니다. 지도에서 곡을 고르고 ＋ 플리 를 누르세요." />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="-mx-1.5 flex flex-col gap-0.5">
              {playlist.items.map((it, i) => (
                <PlaylistSortableRow
                  key={it.musicId}
                  item={it}
                  index={i + 1}
                  active={it.musicId === currentMusicId}
                  editable={editable}
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
                        <PlayIcon size={15} />
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
                          <CloseIcon size={15} />
                        </IconButton>
                      )}
                    </>
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
