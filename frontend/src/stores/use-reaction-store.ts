import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { REACTION_VISIBLE_MS, type ReactionKey } from "@/constants";

export interface FloatingReaction {
  id: string;
  reactionKey: ReactionKey;
  /** 내가 보낸 것(내 위로 뜸)인지, 다른 사람의 것인지 */
  mine: boolean;
  /** 남의 반응은 해당 유저 이메일 (내 뷰 안에 있을 때만 표시) */
  fromEmail: string | null;
  /** 남의 반응일 때 이모지 아래 붙는 이름 */
  nickname?: string | null;
}

interface ReactionState {
  floating: FloatingReaction[];
  /** 마지막 전송 시각 (대상 이메일별) — 반복 전송 제한용 */
  lastSentAt: Record<string, number>;

  push: (reaction: Omit<FloatingReaction, "id">) => void;
  markSent: (toEmail: string) => void;
}

export const useReactionStore = create<ReactionState>()(
  devtools(
    (set) => ({
      floating: [],
      lastSentAt: {},

      push: (reaction) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        set((s) => ({ floating: [...s.floating, { ...reaction, id }] }), false, "push");
        setTimeout(() => {
          set((s) => ({ floating: s.floating.filter((r) => r.id !== id) }), false, "expire");
        }, REACTION_VISIBLE_MS);
      },

      markSent: (toEmail) =>
        set((s) => ({ lastSentAt: { ...s.lastSentAt, [toEmail]: Date.now() } }), false, "markSent"),
    }),
    { name: "reaction-store" },
  ),
);
