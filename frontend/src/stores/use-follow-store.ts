import { create } from "zustand";
import { devtools } from "zustand/middleware";

/**
 * 따라가기 = **탑승(ride)** 상태 (2차 실시간 명세 §12, S15P21A405-530).
 *
 * 이름이 `follow` 인 것은 이 스토어가 먼저 생겼기 때문이고, **구독(follow) 과는 무관하다.**
 * 구독은 서버에 오래 남는 관계(`/api/user/follow/*`)이고 여기 있는 것은 지금 이 순간 남의
 * 탐색을 따라다니는 일이다. 명세는 `use-ride-store` 를 새로 만들라고 적었지만, 그러면 같은
 * 상태를 읽는 자리가 두 군데가 된다 — 이 스토어를 읽는 곳이 이미 아홉 곳이라 옮기는 값보다
 * 어긋날 위험이 크다.
 *
 * **재연결로 되살리지 않는다** (명세 §8.3). 소켓이 새로 열리면 서버가 따라가기를 끊는다.
 * 프론트가 상태를 들고 있다가 자동으로 다시 태우면 서버에 없는 선단을 화면만 그리게 된다.
 */
interface FollowState {
  /** 내가 따라가는 인솔자. null 이면 따라가기 중 아님 */
  leaderEmail: string | null;
  leaderNickname: string | null;
  leaderImageUrl: string | null;
  /**
   * 인솔자가 서 있는 곡. **지도에 인솔자 표식을 그리는 근거다.**
   *
   * 서버가 주는 화면 목록(`RIDE_VIEWPORT*`)에는 **인솔자가 없다** — 요청자 제외 규칙이 인솔자
   * 기준으로 걸리기 때문이다 (2차 명세 §4.2). 그래서 선단 표식은 프론트가 직접 그려야 하고,
   * 그 좌표의 출처가 이 값이다. `RIDE_TRACK` 이 올 때마다 갱신된다.
   */
  leaderMusicId: number | null;
  /**
   * 나를 따라오는 인원 수 (내가 인솔자일 때).
   *
   * **탈 때와 내릴 때 모두 서버가 알려 준다** (3차 계약 §2, S15P21A405-545) —
   * `RIDE_RIDER_JOINED` · `RIDE_RIDER_LEFT` 가 **바뀐 뒤의** 인원을 함께 싣는다. 예전에는
   * 탑승 알림이 없어서 누가 내릴 때까지 숫자를 몰랐고, 그래서 `null` 로 두고 숨겼다.
   * 이제 0 에서 출발해 그대로 믿으면 된다.
   */
  followerCount: number;
  /**
   * 탑승 응답의 재생 스냅샷 번호. **프레임을 거르는 데 쓰지 않는다** —
   * 봉투 `seq` 와 다른 카운터라서다 (`types/realtime.ts` 의 `RideResponse.snapshotSeq` 참고).
   * 디버깅과 백엔드 확인용으로만 들고 있다.
   */
  snapshotSeq: number;
  /**
   * **지금 곡**에 대한 내 재생 기록 번호 (3차 계약 §3, S15P21A405-545).
   *
   * 예전에는 탑승~하차를 한 건으로 보는 값이었다. 이제 인솔자가 곡을 바꿀 때마다
   * `RIDE_TRACK` 이 새 번호를 주므로 곡마다 갈아 끼운다 — 그래야 곡별 청취시간이 남는다.
   * 서버가 번호를 못 받으면 `null` 로 오고, 그 곡은 시간을 못 남긴다.
   */
  playHistoryId: number | null;
  /** 지금 곡을 틀기 시작한 시각. 종료 보고의 `playedMs` 를 여기서 잰다 */
  songStartedAt: number;

  start: (input: {
    email: string;
    nickname: string | null;
    imageUrl: string | null;
    musicId: number;
    snapshotSeq: number;
    playHistoryId: number;
  }) => void;
  /** 곡이 바뀌어 기록 번호가 새것이 됐다. 시작 시각도 같이 갈아 끼운다 */
  setSongRecord: (playHistoryId: number | null, songStartedAt: number) => void;
  /** 인솔자가 곡을 옮겼다 (`RIDE_TRACK`). 표식이 따라가도록 자리만 갱신한다 */
  setLeaderMusicId: (musicId: number) => void;
  /** 하차·강제 종료 공통. 자리는 그대로 두고(map-store 가 남는다) 탑승 상태만 지운다 */
  stop: () => void;
  setFollowerCount: (n: number) => void;
}

export const useFollowStore = create<FollowState>()(
  devtools(
    (set) => ({
      leaderEmail: null,
      leaderNickname: null,
      leaderImageUrl: null,
      leaderMusicId: null,
      followerCount: 0,
      snapshotSeq: 0,
      playHistoryId: null,
      songStartedAt: 0,

      start: ({ email, nickname, imageUrl, musicId, snapshotSeq, playHistoryId }) =>
        set(
          {
            leaderEmail: email,
            leaderNickname: nickname,
            leaderImageUrl: imageUrl,
            leaderMusicId: musicId,
            snapshotSeq,
            playHistoryId,
            songStartedAt: Date.now(),
          },
          false,
          "start",
        ),
      setSongRecord: (playHistoryId, songStartedAt) => set({ playHistoryId, songStartedAt }, false, "setSongRecord"),
      setLeaderMusicId: (leaderMusicId) => set({ leaderMusicId }, false, "setLeaderMusicId"),
      stop: () =>
        set(
          {
            leaderEmail: null,
            leaderNickname: null,
            leaderImageUrl: null,
            leaderMusicId: null,
            snapshotSeq: 0,
            playHistoryId: null,
            songStartedAt: 0,
            followerCount: 0,
          },
          false,
          "stop",
        ),
      setFollowerCount: (followerCount) => set({ followerCount }, false, "setFollowerCount"),
    }),
    { name: "follow-store" },
  ),
);

/** 지금 남을 따라가는 중인가. 조작을 막는 모든 자리가 이 한 줄을 본다 (명세 §6) */
export const isRiding = () => useFollowStore.getState().leaderEmail != null;
