import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface FollowState {
  /** 내가 따라가는 인솔자. null이면 따라가기 중 아님 */
  leaderEmail: string | null;
  leaderNickname: string | null;
  /** 나를 따라오는 인원 수 */
  followerCount: number;

  start: (email: string, nickname: string | null) => void;
  /** 하차. 해제 시점 위치는 유지된다 (map-store가 그대로 남음) */
  stop: () => void;
  setFollowerCount: (n: number) => void;
}

export const useFollowStore = create<FollowState>()(
  devtools(
    (set) => ({
      leaderEmail: null,
      leaderNickname: null,
      followerCount: 0,

      start: (leaderEmail, leaderNickname) => set({ leaderEmail, leaderNickname }, false, "start"),
      stop: () => set({ leaderEmail: null, leaderNickname: null }, false, "stop"),
      setFollowerCount: (followerCount) => set({ followerCount }, false, "setFollowerCount"),
    }),
    { name: "follow-store" },
  ),
);
