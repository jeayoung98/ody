"use client";

import { REACTIONS, type ReactionKey } from "@/constants";

interface ReactionPickerProps {
  onPick: (key: ReactionKey) => void;
}

/** #reactRow — FAB 위로 세로로 펼쳐지는 이모지 열 */
export default function ReactionPicker({ onPick }: ReactionPickerProps) {
  return (
    <div className="glass animate-rpop flex flex-col gap-[5px] rounded-pill! p-1.5">
      {REACTIONS.map((r) => (
        <button
          key={r.key}
          type="button"
          title={r.label}
          onClick={() => onPick(r.key)}
          className="grid h-9 w-9 place-items-center rounded-pill text-[17px] leading-none transition-all duration-fast hover:scale-[1.12] hover:bg-white/[.12]"
        >
          {r.emoji}
        </button>
      ))}
    </div>
  );
}
