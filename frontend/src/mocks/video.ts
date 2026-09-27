/**
 * 목 `videoId` (S15P21A405-467). **`USE_MOCK_API=1` 일 때만** 쓰인다.
 *
 * 원칙은 여전히 "videoId 는 백엔드만 안다" 다 (S15P21A405-340 · 324). 곡에 맞는 영상을 지어낼
 * 방법은 없고, 지어내면 실데이터인 줄 알고 틀린 영상을 본다. 그래서 실백엔드 경로는 손대지 않고
 * **목 모드에만** 붙인다 — 백엔드가 내려가 있는 동안 플레이어바·진행바를 눌러 볼 수단이 없으면
 * 그쪽 작업을 아예 확인할 수 없다.
 *
 * 그래서 아래 영상들은 **곡과 아무 관계가 없다.** 화면이 도는지 보는 용도다.
 */

/**
 * 곡 대신 태울 영상. 조건이 두 개 있다.
 *
 * - **길이가 유한해야 한다.** 라이브 스트림(로파이 라디오 같은 것)은 `getDuration()` 이 0 이라
 *   진행바가 눈금을 못 잡고 0 에 붙어 있다 — 정작 확인하려던 게 안 보인다.
 * - **임베드가 허용돼야 한다.** 막힌 영상은 조용히 소리가 안 난다.
 *
 * Blender Open Movie 는 둘 다 만족하고 CC 라이선스라 오래 살아 있다. 여러 개를 두는 건
 * 곡을 넘길 때 **화면이 바뀌는 게 보여야** 하기 때문이다 — 하나만 박으면 전 곡이 같은 영상이 된다.
 */
const DEMO_VIDEO_IDS = [
  "aqz-KE-bpKQ", // Big Buck Bunny (Blender Foundation)
  "eRsGyueVLvQ", // Sintel (Blender Foundation)
  "R6MlUcmOul8", // Tears of Steel (Blender Foundation)
  "WhWc3b3KhnY", // Spring (Blender Foundation)
];

/**
 * 곡 하나의 목 videoId. `null` 이면 **못 트는 곡**이다.
 *
 * 못 트는 곡을 그대로 두는 이유: 목 곡 데이터셋은 약 11.5% 를 재생 불가로 만들고
 * (`songs.ts` 의 `playable`), 지도는 그 별을 흐리게 그린다. 여기서 전부 틀 수 있다고 답하면
 * 지도와 플레이어가 서로 다른 말을 해서 "재생 불가" 안내 쪽을 확인할 수 없다.
 */
export function mockVideoId(musicId: number, playable: boolean): string | null {
  if (!playable) return null;
  // musicId 로 고정한다 — 같은 곡은 늘 같은 영상이라 새로고침해도 안 바뀐다
  return DEMO_VIDEO_IDS[Math.abs(musicId) % DEMO_VIDEO_IDS.length];
}
