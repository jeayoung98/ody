"use client";

import { REACTIONS, type ReactionKey } from "@/constants";

interface ReactionPickerProps {
  onPick: (key: ReactionKey) => void;
  /** 가로로 펼친다 — 패널 안 한 줄에 들어갈 때 (S15P21A405-434). 기본은 세로 */
  horizontal?: boolean;
}

/** #reactRow — 이모지 열. 세로(FAB 위)나 가로(패널 안 한 줄)로 펼친다 */
export default function ReactionPicker({ onPick, horizontal = false }: ReactionPickerProps) {
  return (
    <div className={`glass animate-rpop flex gap-[5px] rounded-pill! p-1 ${horizontal ? "flex-row" : "flex-col"}`}>
      {REACTIONS.map((r) => (
        <button
          key={r.key}
          type="button"
          title={r.label}
          onClick={() => onPick(r.key)}
          className="grid h-8 w-8 place-items-center rounded-pill text-[16px] leading-none transition-all duration-fast hover:scale-[1.12] hover:bg-white/[.12]"
        >
          {r.emoji}
        </button>
      ))}
    </div>
  );
}
