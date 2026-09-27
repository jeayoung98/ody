"use client";

import CenterDialog from "@/components/common/center-dialog";
import EmptyState from "@/components/common/empty-state";
import SkeletonRows from "@/components/common/skeleton-rows";
import { useAddPlaylistItemMutation } from "@/hooks/mutations/use-add-playlist-item-mutation";
import { useMyPlaylistsQuery } from "@/hooks/queries/use-my-playlists-query";
import CreatePlaylistForm from "./create-playlist-form";

interface AddToPlaylistDialogProps {
  musicId: number;
  onDone: () => void;
}

/**
 * 내 플레이리스트 중 하나에 곡 추가, 또는 새 플레이리스트 생성 후 추가 (SONG-05, PATH-04).
 *
 * **화면 가운데 팝업이다** (S15P21A405-686). 예전에는 누른 자리 위아래로 펼쳐지는 목록이었는데, 재생바에서
 * 위로 펼치면 곡 상세 패널과 겹쳤고, 곡 상세에서 아래로 펼치면 폰에서 재생바·탭바 밑으로 잘렸다(S15P21A405-547).
 * 가운데에 띄우면 어디서 열어도 같은 자리다.
 */
export default function AddToPlaylistDialog({ musicId, onDone }: AddToPlaylistDialogProps) {
  const { data, isPending } = useMyPlaylistsQuery();
  const add = useAddPlaylistItemMutation();

  const handleAdd = (playlistId: number) => {
    add.mutate({ playlistId, musicId }, { onSuccess: onDone });
  };

  return (
    <CenterDialog title="플레이리스트에 추가" onClose={onDone} flush>
      <div className="max-h-64 overflow-y-auto p-1.5">
        {isPending && <SkeletonRows count={3} thumb="none" sub={false} />}
        {data && data.length === 0 && <EmptyState message="아직 플레이리스트가 없어요." />}
        {data?.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => handleAdd(p.id)}
            disabled={add.isPending}
            className="flex w-full items-center justify-between rounded-box-sm border border-transparent px-[9px] py-2 text-left text-sm transition-colors hover:border-line hover:bg-white/[.055]"
          >
            <span className="truncate">{p.playlistName}</span>
            <span className="num text-[12.5px] text-ink-3">{p.itemCount}곡 · ＋</span>
          </button>
        ))}
      </div>
      <div className="border-t border-line p-2.5">
        <CreatePlaylistForm onCreated={(p) => handleAdd(p.id)} />
      </div>
    </CenterDialog>
  );
}
