/**
 * 지도 위 사람 표식의 **배치를 붙들어 두기** (S15P21A405-566).
 *
 * `updateFriends` 는 매 프레임 화면 좌표로 칸을 나누고(58px) 누가 제 모습으로 서고 누가 남의
 * 배지 숫자로 묶일지를 정한다. 그런데 화면 좌표는 **사람이 움직이거나 지도를 밀기만 해도**
 * 바뀐다 — 칸 경계를 넘나들면서 묶임이 붙었다 떨어졌다 하고, 그게 깜빡임으로 보인다.
 *
 * 같은 문제를 앨범 커버에서 먼저 풀었다 (S15P21A405-529): **배율이 그대로면 고르기를 다시
 * 하지 않는다.** 여기도 같은 규칙을 쓴다 — 자리는 매 프레임 갱신하되 **누가 대표인지는**
 * 배율이 바뀌거나 명단이 바뀔 때만 다시 정한다.
 */

/** 표식 하나와, 그 자리에 묶인 사람들 */
export interface FriendPlanEntry {
  marker: string;
  stacked: string[];
}

/**
 * 지난 배치를 그대로 쓸 수 있으면 돌려주고, 아니면 `null`.
 *
 * **명단이 정확히 같을 때만 쓴다.** 한 명이라도 들거나 나면 다시 정한다 — 빠진 사람을 그대로
 * 그리면 없는 사람이 남고, 새로 온 사람은 아예 안 그려진다. "거의 같으면 재활용" 같은 여지를
 * 두지 않는 이유는, 그 틈으로 새는 사람이 생기면 **화면에는 아무 표시도 안 남기 때문이다.**
 */
export function reusablePlan(plan: readonly FriendPlanEntry[] | null, present: ReadonlySet<string>): FriendPlanEntry[] | null {
  if (!plan) return null;
  let count = 0;
  for (const entry of plan) {
    if (!present.has(entry.marker)) return null;
    count += 1;
    for (const email of entry.stacked) {
      if (!present.has(email)) return null;
      count += 1;
    }
  }
  // 지금 있는 사람이 배치보다 많다 = 새로 온 사람이 있다
  return count === present.size ? [...plan] : null;
}
