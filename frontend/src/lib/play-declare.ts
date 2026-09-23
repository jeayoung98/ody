/**
 * **재생 선언을 언제, 무엇으로 보낼지** (S15P21A405-569).
 *
 * 선언(`POST /api/music/play`)은 서버에서 다섯 가지를 한꺼번에 한다 — 지도 위치 이동, 재생
 * 기록, 발견자, 만남 집계, 그리고 따라오는 사람에게 보내는 `RIDE_TRACK`. 그래서 **한 번
 * 빠지면 다섯이 통째로 빠진다.**
 *
 * 예전에는 화면 다섯 곳이 각자 불렀고 큐가 자동으로 넘어가는 길 셋(`next` 를 타는 곡 끝남·
 * 못 트는 곡·다음 버튼)에는 아무도 없었다. 그래서 열 곡짜리 목록을 돌려도 서버는 1번 곡만
 * 알았다. 이제 곡이 바뀌는 자리 한 곳에서만 부른다.
 *
 * 규칙을 떼어 둔 이유는 **안 보내야 하는 두 경우가 조용히 망가지기 때문이다.** 따라가는 중에
 * 보내면 곡마다 409 가 쌓이고, 설문 창의 다시 듣기에 보내면 내 지도 위치가 엉뚱하게 움직인다.
 * 둘 다 화면에는 아무 표시도 안 난다.
 */

import type { PlaySource } from "@/types";

/** 큐의 맥락 — `use-player-store` 의 `PlayContext` 중 `kind` 만 본다 */
export type PlayContextKind = "single" | "playlist" | "journey" | "nearby";

/**
 * 이 재생을 서버에 알릴 `source`.
 *
 * `nearby`(주변 탐색)가 `MAP` 인 것은 백엔드 enum 에 그 항목이 없어서다 — 지도에서 걸어
 * 들어간 것이라 `MAP` 으로 친다. `FOLLOW` 는 서버가 따라가기 경로에서 직접 쓰므로 프론트가
 * 보내지 않는다.
 */
export function playSourceOf(kind: PlayContextKind): PlaySource {
  if (kind === "journey") return "JOURNEY";
  if (kind === "playlist") return "PLAYLIST";
  return "MAP";
}

export interface DeclareInput {
  musicId: number | null;
  /** `playSingle`·`playQueue`·`next`·`prev` 가 올리는 번호. `preview`·`stop` 은 안 올린다 */
  declareSeq: number;
  /** 직전에 선언한 번호. 아직 없으면 `null` */
  lastSeq: number | null;
  riding: boolean;
}

/**
 * 지금 선언해야 하는가.
 *
 * **번호로 가른다.** 곡 ID 로 비교하면 같은 곡을 다시 튼 경우(한 바퀴 돌아 제자리, 또는
 * 이전 버튼으로 되돌아옴)를 놓친다 — 서버 입장에서는 그것도 새 재생이다.
 */
export function shouldDeclare({ musicId, declareSeq, lastSeq, riding }: DeclareInput): boolean {
  if (musicId == null) return false;
  // 따라가는 중에는 내 재생이 아니라 인솔자의 재생이다. 서버도 409 로 막는다
  if (riding) return false;
  return declareSeq !== lastSeq;
}
