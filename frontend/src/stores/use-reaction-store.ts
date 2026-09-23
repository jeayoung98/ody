import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { REACTION_VISIBLE_MS } from "@/constants";

export interface FloatingReaction {
  id: string;
  /** 서버가 넘겨 준 키 그대로. 우리 세트에 없으면 ✨ 로 그린다 */
  reactionKey: string;
  /** 내가 보낸 것(내 위로 뜸)인지, 다른 사람의 것인지 */
  mine: boolean;
  /** 남의 반응은 해당 유저 이메일 (내 뷰 안에 있을 때만 표시) */
  fromEmail: string | null;
  /** 남의 반응일 때 이모지 아래 붙는 이름 */
  nickname?: string | null;
}

interface ReactionState {
  floating: FloatingReaction[];
  push: (reaction: Omit<FloatingReaction, "id">) => void;
}

/**
 * 지도 위에 떠 있는 반응들 (SOCIAL-02). 재전송 제한(SOCIAL-04)은 서버가 429 로 막는다 —
 * 여기서 따로 세지 않는다.
 */
export const useReactionStore = create<ReactionState>()(
  devtools(
    (set) => ({
      floating: [],

      push: (reaction) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        set((s) => ({ floating: [...s.floating, { ...reaction, id }] }), false, "push");
        setTimeout(() => {
          set((s) => ({ floating: s.floating.filter((r) => r.id !== id) }), false, "expire");
        }, REACTION_VISIBLE_MS);
      },
    }),
    { name: "reaction-store" },
  ),
);
