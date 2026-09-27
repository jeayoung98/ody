/**
 * 우주선 기수를 **돌려서** 바꾼다 (S15P21A405-709).
 *
 * 예전에는 기수가 그 프레임의 진행 방향을 그대로 받았다. 그래서 출발하는 순간 새 방향으로 한 번에
 * 튀었고, 내 우주선은 도착하면 방향이 없어져 위로 돌아갔다.
 *
 * 이제 그리는 각도는 목표 각도를 **짧은 쪽으로 따라간다.** 비행은 천천히 출발하므로(`arc.ts` 의
 * easeInOut) 기수가 먼저 돌고 몸이 뒤따라, 서서 고개를 튼 뒤 떠나는 것처럼 보인다.
 * 목표가 없으면(`null`) 마지막 각도를 그대로 둔다 — 날아온 방향을 보고 서 있는다.
 */

/** 남은 각도가 1/e 로 줄어드는 시간(ms). 약 200ms 면 거의 다 돈다 — 비행 1.5초의 앞 1할 남짓이다 */
export const SHIP_TURN_TAU_MS = 70;
/** 이만큼 안 그려졌다가 다시 나오면 도는 연출 없이 바로 그 각도로 둔다 — 안 보이던 배가 나타나며 빙글 돌면 이상하다 */
const STALE_MS = 500;

const TAU = Math.PI * 2;
/** a 에서 b 로 가는 가장 짧은 회전량 (-π, π] */
export function shortestTurn(a: number, b: number) {
  const d = (((b - a) % TAU) + TAU) % TAU;
  return d > Math.PI ? d - TAU : d;
}

export class ShipTurn {
  private readonly m = new Map<string, { ang: number; t: number }>();

  /**
   * `key` 우주선의 이번 프레임 기수 각도.
   * @param target 향해야 할 각도. `null` 이면 방향이 없는 것이라 지금 각도를 유지한다
   * @param fallback 처음 보는 우주선인데 `target` 도 없을 때 쓸 각도
   */
  step(key: string, target: number | null, now: number, fallback = 0): number {
    const was = this.m.get(key);
    if (!was || now - was.t > STALE_MS) {
      const ang = target ?? was?.ang ?? fallback;
      this.m.set(key, { ang, t: now });
      return ang;
    }
    if (target == null) {
      was.t = now;
      return was.ang;
    }
    const k = 1 - Math.exp(-Math.max(0, now - was.t) / SHIP_TURN_TAU_MS);
    const ang = was.ang + shortestTurn(was.ang, target) * k;
    this.m.set(key, { ang, t: now });
    return ang;
  }
}
