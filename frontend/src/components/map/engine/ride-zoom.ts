/**
 * 휠 한 칸이 **무엇이 되는가** (S15P21A405-562).
 *
 * 이 지도에서 휠은 두 가지 일을 한다 — 배율을 바꾸거나(`zoom`), 겹을 넘나드는 압력을
 * 채우거나(`dig`·`rise`). 따라가는 중에는 **앞엣것만** 허용한다. 확대·축소는 내가 어디를
 * 볼지의 문제라 선단이 어디로 가느냐와 상관이 없고, 겹은 인솔자가 정하는 것이라
 * 따라가는 사람이 혼자 파고들면 선단에서 떨어져 나간다 (S15P21A405-560).
 *
 * 떼어 둔 이유는 **틀려도 화면에 티가 안 나기 때문이다.** 겹이 안 바뀌는 것은 `descend` 가
 * 어차피 막지만, 압력만 차고 안 열리는 계기는 "눌렀는데 아무 일도 없는" 그 상태가 된다.
 */
export type WheelIntent = "dig" | "rise" | "zoom";

export function wheelIntent(input: { riding: boolean; zoomIn: boolean; gateOpen: boolean; zoomedOutEnough: boolean; hasStack: boolean }): WheelIntent {
  // 따라가는 중이면 겹을 넘나드는 길은 아예 없다
  if (input.riding) return "zoom";
  if (input.zoomIn) return input.gateOpen ? "dig" : "zoom";
  return input.hasStack && input.zoomedOutEnough ? "rise" : "zoom";
}
