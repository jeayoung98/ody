import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface UnplayableState {
  /**
   * 조회 끝에 **영상이 없다고 판명된** 곡들 (S15P21A405-544).
   *
   * 서버가 `playable: false` 로 알려 주는 곡과는 출처가 다르다. 그쪽은 지도 데이터가 올 때부터
   * 알 수 있고, 이쪽은 곡을 열어 `videoId` 를 물어봐야 알게 된다.
   */
  ids: ReadonlySet<number>;
  /** 영상이 없다고 판명됐다. 이미 들어 있으면 **같은 Set 을 유지한다** — 구독자를 깨우지 않는다 */
  markUnplayable: (musicId: number) => void;
}

/**
 * 못 트는 곡을 화면에서 빼기 위한 기억 (S15P21A405-544).
 *
 * **이번 접속 동안만 기억한다.** 저장소에 남기면 백엔드가 나중에 그 곡의 영상을 찾아도 영영
 * 가려진다 — `videoid` 조회는 DB 에 없으면 외부에서 찾아 채우는 동작이라 어제 없던 곡이 오늘
 * 생길 수 있다. 새로고침하면 서버 판단부터 다시 시작하는 편이 맞다.
 *
 * ponytail: 메모리 Set 하나다. 곡 수가 아주 많아져 이 집합이 커지면 그때 상한을 두거나
 * 겹이 바뀔 때 비운다 — 한 세션에서 열어 보는 곡 수로는 문제가 되지 않는다.
 *
 * **판정은 여기서 하지 않는다.** 무엇이 "못 트는 곡" 인지는 `usePlayability` 한 곳이 정하고
 * (`notFound` 만), 이 스토어는 그 결론을 담아 둘 뿐이다.
 */
export const useUnplayableStore = create<UnplayableState>()(
  devtools(
    (set) => ({
      ids: new Set<number>(),
      markUnplayable: (musicId) =>
        set(
          (s) => (s.ids.has(musicId) ? s : { ids: new Set(s.ids).add(musicId) }),
          false,
          "markUnplayable",
        ),
    }),
    { name: "unplayable-store" },
  ),
);

/**
 * **거르는 자리가 둘로 갈렸다** (S15P21A405-544). 하나로 묶는 헬퍼를 뒀다가 걷어냈다 —
 * 두 곳이 같은 일을 다른 시점에 하기 때문이다.
 *
 * - 서버가 `playable:false` 로 준 곡: 지도 데이터가 **들어올 때** 걸러진다 (`map-view`)
 * - 열어 보고 알게 된 곡: 이미 깔린 별을 **그 자리에서** 뺀다 (`MapEngine.hideSong`)
 *
 * 검색은 앞엣것이 애초에 응답에 없으므로 뒤엣것만 본다.
 */
