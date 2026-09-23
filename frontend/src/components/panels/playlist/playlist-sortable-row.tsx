"use client";

import { useSortable } from "@dnd-kit/sortable";
import type { ReactNode } from "react";
import IconButton from "@/components/common/icon-button";
import { GripIcon } from "@/components/common/icons";
import TrackRow from "@/components/common/track-row";
import type { PlaylistItemWithMusic } from "@/types";

interface PlaylistSortableRowProps {
  item: PlaylistItemWithMusic;
  /** 화면에 보이는 번호 (1부터) */
  index: number;
  active: boolean;
  /** 손잡이를 붙일지. 남의 플리면 false 라 줄이 그냥 목록이 된다 */
  editable: boolean;
  onClick: () => void;
  /** 손잡이 오른쪽에 붙는 것들 (재생·삭제) */
  actions: ReactNode;
}

/**
 * 끌어서 옮길 수 있는 곡 한 줄 (S15P21A405-540).
 *
 * **손잡이에만 끌기를 건다.** 줄 전체를 잡게 하면 "이 곡부터 재생" 과 겹친다 — 누르려다 1px 만
 * 밀려도 재생 대신 끌기가 시작되고, 그 반대도 마찬가지다. 잡을 곳을 눈에 보이게 따로 두면
 * 두 동작이 서로를 건드리지 않는다.
 *
 * **키보드로도 옮길 수 있다.** 손잡이에 초점을 두고 스페이스로 집은 뒤 위·아래 화살표로 옮기고
 * 다시 스페이스로 놓는다. `KeyboardSensor` 가 붙어 있어서 공짜로 따라오는 동작이다 — 버튼을
 * 걷어내면서 키보드 사용자가 순서를 못 바꾸게 되는 것이 이 교체의 유일한 위험이었다.
 *
 * `TrackRow` 는 손대지 않고 **감싸는 div** 에 자리 옮김을 건다. 그 컴포넌트는 여섯 화면이
 * 같이 쓰는 것이라, 끌기 하나 때문에 ref 를 뚫는 것보다 여기서 덮는 편이 안전하다.
 */
export default function PlaylistSortableRow({ item, index, active, editable, onClick, actions }: PlaylistSortableRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.musicId,
    disabled: !editable,
  });

  /**
   * **세로로만 옮긴다.** `transform.x` 를 버리면 가로로 새지 않는다 — 한 줄짜리 세로 목록에서
   * 가로 이동은 의미가 없고, 손가락이 비스듬히 움직일 때 줄이 좌우로 흔들려 보인다.
   * 이것만으로 되므로 `@dnd-kit/modifiers` 를 따로 받지 않는다.
   */
  const style = {
    transform: transform ? `translate3d(0, ${Math.round(transform.y)}px, 0)` : undefined,
    transition,
    // 끌고 있는 줄은 남은 줄 위에 뜬다. 안 그러면 다음 줄 밑으로 파고든다
    zIndex: isDragging ? 1 : undefined,
    opacity: isDragging ? 0.85 : undefined,
    position: isDragging ? ("relative" as const) : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TrackRow
        index={index}
        title={item.music.title}
        artist={item.music.artist}
        duration={item.music.duration}
        active={active}
        onClick={onClick}
        actions={
          <>
            {editable && (
              <IconButton
                label="끌어서 순서 바꾸기"
                size={26}
                // 끌기는 손잡이에서만 시작한다. 줄 전체에 걸면 재생과 겹친다
                ref={setActivatorNodeRef}
                className="cursor-grab touch-none active:cursor-grabbing"
                // 손잡이를 눌러도 줄 클릭(재생)으로 올라가지 않게 막는다
                onClick={(e) => e.stopPropagation()}
                {...attributes}
                {...listeners}
              >
                <GripIcon size={15} />
              </IconButton>
            )}
            {actions}
          </>
        }
      />
    </div>
  );
}
