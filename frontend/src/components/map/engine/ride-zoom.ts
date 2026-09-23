/**
 * 휠 한 칸이 **무엇이 되는가** — 배율을 바꾸거나(`zoom`), 겹을 넘나드는 압력을 채우거나(`dig`·`rise`).
 *
 * 따라가는 중의 분기는 여기 없다 (S15P21A405-605). 562 에서는 "따라가면 zoom 만" 이었는데,
 * 기획이 따라가는 동안 지도 조작을 전부 막기로 해서 엔진이 이 함수에 오기 전에 거른다.
 *
 * 떼어 둔 이유는 **틀려도 화면에 티가 안 나기 때문이다.** 겹이 안 바뀌는 것은 `descend` 가
 * 어차피 막지만, 압력만 차고 안 열리는 계기는 "눌렀는데 아무 일도 없는" 그 상태가 된다.
 */
export type WheelIntent = "dig" | "rise" | "zoom";

export function wheelIntent(input: { zoomIn: boolean; gateOpen: boolean; zoomedOutEnough: boolean; hasStack: boolean }): WheelIntent {
  if (input.zoomIn) return input.gateOpen ? "dig" : "zoom";
  return input.hasStack && input.zoomedOutEnough ? "rise" : "zoom";
}
