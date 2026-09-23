/**
 * 따라가는 사람이 **어느 겹으로 옮겨야 하는가** (S15P21A405-560).
 *
 * 탑승 응답과 `RIDE_TRACK` 이 `layer` 를 같이 주는데 프론트가 그 값을 버리고 있었다 —
 * 인솔자가 파고들면 따라가는 사람만 제자리에 남고, 그 겹에 없는 곡을 가리키는 바람에
 * 우주선까지 사라졌다.
 *
 * 판단 자체는 한 줄이지만 **잘못 짚으면 조용히 망가진다.** 범위 밖 값이 오면 엔진이 없는 겹으로
 * 모프하고, 같은 겹인데 옮기면 지도가 이유 없이 한 번 출렁인다. 그래서 떼어 두고 수치로 묶는다.
 */

import { LAYER_COUNT } from "@/constants/map";

/**
 * 지금 겹에서 서버가 말한 겹으로 옮겨야 하면 그 번호, 아니면 `null`.
 *
 * `null` 을 돌려주는 경우가 셋이다 — 이미 그 겹이거나, 서버가 겹을 안 줬거나(옛 배포),
 * 있을 수 없는 번호이거나. **셋 다 "아무것도 하지 않는다" 가 맞다**: 모르는 겹으로 옮기는 것은
 * 제자리에 있는 것보다 나쁘고, 되돌릴 길도 없다.
 */
export function rideLayerTarget(current: number, fromServer: number | null | undefined): number | null {
  if (fromServer == null || !Number.isInteger(fromServer)) return null;
  if (fromServer < 0 || fromServer >= LAYER_COUNT) return null;
  return fromServer === current ? null : fromServer;
}
