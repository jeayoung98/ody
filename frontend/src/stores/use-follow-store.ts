import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { STORAGE_KEYS } from "@/constants";
import { removeStorage, writeStorage } from "@/lib/storage";
import type { RideRider } from "@/types";

/**
 * 따라가기 = **탑승(ride)** 상태 (2차 실시간 명세 §12, S15P21A405-530).
 *
 * 이름이 `follow` 인 것은 이 스토어가 먼저 생겼기 때문이고, **구독(follow) 과는 무관하다.**
 * 구독은 서버에 오래 남는 관계(`/api/user/follow/*`)이고 여기 있는 것은 지금 이 순간 남의
 * 탐색을 따라다니는 일이다. 명세는 `use-ride-store` 를 새로 만들라고 적었지만, 그러면 같은
 * 상태를 읽는 자리가 두 군데가 된다 — 이 스토어를 읽는 곳이 이미 아홉 곳이라 옮기는 값보다
 * 어긋날 위험이 크다.
 *
 * **재연결·새로고침 뒤에는 다시 탄다** (S15P21A405-615). 소켓이 새로 열리면 서버가 따라가기를
 * 끊으므로(명세 §8.3) 상태를 그대로 그리면 서버에 없는 선단이 된다 — 그래서 인솔자를 저장소에
 * 남겨 두고 `use-ride-session` 이 **새 탑승 요청**을 보낸다. 여기는 그 저장을 시작·정지에 맞춰 쓴다.
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
   * 인솔자가 서 있는 **겹** (S15P21A405-676). 탑승 응답·`RIDE_TRACK` 이 준다. `null` 이면 모른다(누르는 순간의 임시 화면).
   * 지도가 이 겹이 아니면 `map-view` 가 먼저 옮긴다 — 새로고침 복원처럼 응답이 지도 데이터보다 먼저 온 경우를 위해서다.
   */
  leaderLayer: number | null;
  /**
   * 인솔자가 **열어 둔 상세 곡** (2차 명세 §4.4 `RIDE_PANEL`). `null` 이면 닫혀 있다.
   *
   * 서 있는 곡(`leaderMusicId`)과 **다를 수 있다.** 옆 별을 눌러 보는 동안이 그렇다 —
   * 그때 우주선은 그대로 있고 우측 패널만 바뀐다.
   */
  leaderViewingMusicId: number | null;
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
   * 인솔자 곡의 좌표가 **뒤늦게** 지도에 들어왔다 (S15P21A405-674). `map-view` 의 따라가기 효과가 이 값을 의존성에
   * 두어 다시 돈다 — 스토어의 다른 값은 그대로라 이게 없으면 `startFollow` 를 다시 부를 계기가 없다.
   */
  pointRevision: number;
  /**
   * 나를 따라오는 사람들 (S15P21A405-676). `followerCount` 가 수고, 이건 **누구**다 — 헬멧에 얼굴을 넣으려면
   * 사람이 필요하다. 수와 목록이 어긋날 수 있다(새로고침 뒤엔 목록이 비어 있다): 모자란 만큼은 빈 헬멧으로 그린다.
   */
  riders: RideRider[];

  start: (input: {
    email: string;
    nickname: string | null;
    imageUrl: string | null;
    musicId: number;
    snapshotSeq: number;
    layer?: number | null;
  }) => void;
  /** 인솔자가 곡을 옮겼다 (`RIDE_TRACK`). 표식이 따라가도록 자리만 갱신한다 */
  setLeaderMusicId: (musicId: number) => void;
  setLeaderLayer: (layer: number | null) => void;
  /** 인솔자가 상세를 열거나 닫았다 (`RIDE_PANEL`). 재생은 건드리지 않는다 */
  setLeaderViewingMusicId: (musicId: number | null) => void;
  /** 하차·강제 종료 공통. 자리는 그대로 두고(map-store 가 남는다) 탑승 상태만 지운다 */
  stop: () => void;
  setFollowerCount: (n: number) => void;
  /** 인솔자 곡 좌표를 편입했다 — 따라가기 효과를 한 번 더 돌린다 */
  markPointAdopted: () => void;
  addRider: (rider: RideRider) => void;
  removeRider: (email: string) => void;
  setRiderImage: (email: string, imageUrl: string | null) => void;
  setRiders: (riders: RideRider[]) => void;
}

export const useFollowStore = create<FollowState>()(
  devtools(
    (set) => ({
      leaderEmail: null,
      leaderNickname: null,
      leaderImageUrl: null,
      leaderMusicId: null,
      leaderLayer: null,
      leaderViewingMusicId: null,
      followerCount: 0,
      snapshotSeq: 0,
      pointRevision: 0,
      riders: [],

      start: ({ email, nickname, imageUrl, musicId, snapshotSeq, layer = null }) => {
        writeStorage(STORAGE_KEYS.rideLeader, { email, nickname, imageUrl }, "session");
        set(
          {
            leaderEmail: email,
            leaderNickname: nickname,
            leaderImageUrl: imageUrl,
            leaderMusicId: musicId,
            leaderLayer: layer,
            leaderViewingMusicId: null,
            snapshotSeq,
          },
          false,
          "start",
        );
      },
      setLeaderMusicId: (leaderMusicId) => set({ leaderMusicId }, false, "setLeaderMusicId"),
      setLeaderLayer: (leaderLayer) => set({ leaderLayer }, false, "setLeaderLayer"),
      setLeaderViewingMusicId: (leaderViewingMusicId) => set({ leaderViewingMusicId }, false, "setLeaderViewingMusicId"),
      stop: () => {
        removeStorage(STORAGE_KEYS.rideLeader);
        set(
          {
            leaderEmail: null,
            leaderNickname: null,
            leaderImageUrl: null,
            leaderMusicId: null,
            leaderLayer: null,
            leaderViewingMusicId: null,
            snapshotSeq: 0,
            followerCount: 0,
            riders: [],
          },
          false,
          "stop",
        );
      },
      setFollowerCount: (followerCount) => set({ followerCount }, false, "setFollowerCount"),
      markPointAdopted: () => set((s) => ({ pointRevision: s.pointRevision + 1 }), false, "markPointAdopted"),
      // 같은 사람이 두 번 오면(재탑승, A-74) 한 줄로 둔다
      addRider: (rider) => set((s) => ({ riders: [...s.riders.filter((r) => r.email !== rider.email), rider] }), false, "addRider"),
      removeRider: (email) => set((s) => ({ riders: s.riders.filter((r) => r.email !== email) }), false, "removeRider"),
      setRiderImage: (email, imageUrl) => set((s) => ({ riders: s.riders.map((r) => (r.email === email ? { ...r, imageUrl } : r)) }), false, "setRiderImage"),
      setRiders: (riders) => set({ riders }, false, "setRiders"),
    }),
    { name: "follow-store" },
  ),
);

/** 지금 남을 따라가는 중인가. 조작을 막는 모든 자리가 이 한 줄을 본다 (명세 §6) */
export const isRiding = () => useFollowStore.getState().leaderEmail != null;
