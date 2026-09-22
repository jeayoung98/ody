import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { STORAGE_KEYS } from "@/constants";
import { readStorage, writeStorage } from "@/lib/storage";
import type { BotSeed } from "@/lib/bots/roster";
import type { BotEpisode } from "@/lib/bots/sim";

/** 봇 한 명의 지금 모습 = 고정된 정체 + 흘러가는 상태 */
export interface BotLive extends BotSeed {
  episode: BotEpisode;
}

/**
 * 봇의 현재 상태를 담아 두는 곳 (S15P21A405-536).
 *
 * **그리는 쪽과 굴리는 쪽을 끊어 놓는 자리다.** 시뮬레이션을 돌리는 훅은 하나(`use-bots`)인데
 * 읽는 곳은 지도·주변 사람 패널·프로필 셋이다. 스토어를 사이에 두지 않으면 그 훅을 세 군데서
 * 각각 돌리게 되고, 봇이 화면마다 다른 곡을 듣게 된다.
 *
 * TanStack Query 를 쓰지 않는다 — 서버 상태가 아니라 이 브라우저가 만들어 내는 값이다.
 */
interface BotState {
  bots: BotLive[];
  /**
   * 내가 구독(팔로우)한 봇. **서버에 없는 관계라 여기 남는다** — 봇 계정이 DB 에 없으니
   * `/api/user/follow/*` 로 보낼 수도, 받아 올 수도 없다.
   */
  following: string[];
  setBots: (bots: BotLive[]) => void;
  toggleFollow: (email: string) => void;
}

const loadFollowing = (): string[] => readStorage<string[]>(STORAGE_KEYS.botFollowing) ?? [];

export const useBotStore = create<BotState>()(
  devtools(
    (set) => ({
      bots: [],
      /**
       * 새로고침 너머로 들고 간다. 시연 도중 새로고침 한 번에 팔로우가 날아가면 "팔로우가
       * 동작한다" 를 보여 주려던 것이 도리어 반증이 된다.
       */
      following: loadFollowing(),

      setBots: (bots) => set({ bots }, false, "setBots"),
      toggleFollow: (email) =>
        set(
          (s) => {
            const following = s.following.includes(email) ? s.following.filter((e) => e !== email) : [...s.following, email];
            writeStorage(STORAGE_KEYS.botFollowing, following);
            return { following };
          },
          false,
          "toggleFollow",
        ),
    }),
    { name: "bot-store" },
  ),
);

/** 이 봇을 구독 중인가. 렌더 밖(뮤테이션 안)에서도 봐야 해서 함수로 둔다 */
export const isFollowingBot = (email: string): boolean => useBotStore.getState().following.includes(email);

export const botLiveOf = (email: string): BotLive | undefined => useBotStore.getState().bots.find((b) => b.email === email);
