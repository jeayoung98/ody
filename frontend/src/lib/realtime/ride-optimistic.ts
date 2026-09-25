/**
 * 따라가기를 **누른 즉시** 화면을 세워도 되는가 (S15P21A405-642).
 *
 * 탑승은 왕복 두 번이다 — presence 확인(`joinAndWait`)과 `POST /api/realtime/ride`. 그 사이
 * 화면이 가만히 있으면 버튼만 먹은 것처럼 보여서, 답을 기다리지 않고 먼저 따라가는 화면을 세운다.
 * 거절되면 누르기 전 자리로 되돌린다.
 *
 * **먼저 세워도 되는 경우만 고른다.** 판단을 `use-ride-mutation` 안에 두지 않고 떼어 둔 이유는
 * 아래 두 번째 규칙이 눈에 안 띄는 사고를 막는 것이라서다 — 조건문 한 줄로 묻혀 있으면 다음에
 * 누가 지운다.
 */
export function canRideOptimistically(input: {
  /** 지금 따라가는 인솔자. 없으면 `null` */
  ridingEmail: string | null;
  /** 이번에 따라가려는 사람 */
  targetEmail: string;
  /** 다시 잇기(`ride-resume`) 인가 */
  silent: boolean;
}): boolean {
  /**
   * 다시 잇기는 **복구 경로**다. 사용자가 누른 것이 아니라 소켓이 다시 열려서 도는 길이라,
   * 확정 전에 화면을 세울 이유가 없다. 실패하면 `giveUp` 이 따로 정리한다.
   */
  if (input.silent) return false;
  /**
   * **남을 이미 따라가는 중이면 손대지 않는다.**
   *
   * 그 자리에서 낙관적으로 갈아타 버리면, 서버가 `RIDE_ALREADY_RIDING` 으로 거절했을 때
   * 되돌릴 자리가 이전 인솔자가 아니라 **아무 데도 아니게** 된다 — 멀쩡히 타고 있던 선단에서
   * 내려지는 셈이다. 갈아타기는 `useStartActivity` 가 먼저 하차를 보내고 오는 길이라
   * 그때는 이 값이 비어 있다.
   */
  if (input.ridingEmail && input.ridingEmail !== input.targetEmail) return false;
  return true;
}
