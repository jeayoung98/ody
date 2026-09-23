/**
 * 따라가기를 **다시 걸어야 하는가** (S15P21A405-559).
 *
 * `startFollow` 는 진행 중인 우주선 비행(`follow.mv`)을 지우고 처음부터 세운다. 그래서 곡이
 * 바뀔 때마다 부르면, 방금 건 비행이 곧바로 취소돼 **화면만 옮겨가고 우주선은 제자리에
 * 멈춰 있다.** 인솔자가 곡을 옮기는 것은 `rideTo` 가 맡는 일이지 다시 거는 일이 아니다.
 *
 * 다시 걸어야 하는 경우는 둘뿐이다 — **따라가는 사람이 바뀌었을 때**와 **겹이 바뀌었을 때**다.
 * 겹이 끼는 이유는 좌표계가 겹마다 다르고, `startFollow` 가 그 곡이 지금 겹 상주 집합에 있을
 * 때만 켜지기 때문이다.
 */

export interface FollowKey {
  email: string;
  layer: number;
}

/** 아직 아무도 안 따라가는 중이면 `null` 을 넘긴다 */
export function shouldRestartFollow(current: FollowKey | null, next: FollowKey): boolean {
  if (!current) return true;
  return current.email !== next.email || current.layer !== next.layer;
}
