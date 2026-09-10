"use client";

import Button from "@/components/common/button";
import Note from "@/components/common/note";
import { LAYER_NAMES } from "@/constants";
import { useMapStore } from "@/stores/use-map-store";

/**
 * 이 곡이 지금 겹에 없을 때만 뜨는 안내 (MAP-12).
 * 고스트별을 눌러 상세만 열어본 상태이고, 이동은 여기서 한 번 더 눌러야 일어난다 —
 * 파고든 경로를 통째로 버리는 큰 이동이라 자동으로 하지 않는다.
 */
export default function SongElsewhereNote({ musicId }: { musicId: number }) {
  const layer = useMapStore((s) => s.layer);
  const surfaceToMusic = useMapStore((s) => s.surfaceToMusic);

  return (
    <div className="flex flex-col gap-2 rounded-box border border-dashed border-violet/35 bg-violet/[.06] px-3 py-2.5">
      <Note>
        이 곡은 지금 보고 있는 <b>{LAYER_NAMES[layer]}</b> 갈래에 없습니다. 확대해 들어오면서 다른 쪽으로 갈라져 나갔어요.
      </Note>
      <Button size="sm" onClick={() => surfaceToMusic(musicId)}>
        이 곡이 있는 곳으로 가기
      </Button>
      <Note>
        누르면 <b>{LAYER_NAMES[0]}</b>까지 떠올랐다가 그 곡으로 갑니다. 지금 갈래로 돌아오려면 다시 파고들어야 해요.
      </Note>
    </div>
  );
}
