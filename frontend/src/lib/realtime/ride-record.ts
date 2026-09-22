/**
 * 따라가는 동안의 **곡별 재생 기록** — 순수 함수 (3차 계약 §3, S15P21A405-545).
 *
 * 인솔자가 곡을 바꾸면 `RIDE_TRACK` 에 **내 새 기록 번호**가 실려 온다. 들고 있던 번호로 앞
 * 곡의 종료를 보내고 새 번호로 갈아 끼워야 곡별 청취시간이 남는다 — 안 하면 탑승부터 하차까지가
 * 한 건으로 묻힌다.
 *
 * 규칙이 세 갈래라 떼어냈다. 번호가 없던 상태, 번호가 `null` 로 오는 경우, 그리고 시간 계산.
 * 셋 다 소켓이 와야 재현되는 자리라 눈으로 확인할 수 없다 (`tests/ride-record.test.cjs`).
 */

import { PLAY_END } from "@/constants";
import type { PlayEndRequest } from "@/types";

export interface SongRecord {
  /** 지금 곡의 내 재생 기록 번호. `null` 이면 이 곡은 시간을 못 남긴다 */
  playHistoryId: number | null;
  /** 이 곡을 틀기 시작한 시각(epoch ms) */
  songStartedAt: number;
}

/**
 * 곡이 바뀌었다 — 앞 곡에 대해 보낼 것과, 새로 들고 있을 것.
 *
 * `end` 가 `null` 인 경우가 둘이다. 앞 곡의 번호를 애초에 못 받았을 때(그 곡은 기록 자체가
 * 없다)와, 아직 아무 곡도 안 틀었을 때다. **둘 다 보내면 안 된다** — 번호 없는 종료 요청은
 * 400 이고, 남의 번호를 추측해 보내면 남의 기록을 건드린다.
 *
 * `playedMs` 는 상한으로 자른다 (1차 §12.6). 탭을 열어 두고 방치하면 경과시간이 실제로 들은
 * 시간과 상관없이 커진다.
 */
export function onTrackChange(prev: SongRecord | null, incomingId: number | null, now: number): { end: PlayEndRequest | null; next: SongRecord } {
  return {
    end: endOf(prev, now),
    next: { playHistoryId: incomingId, songStartedAt: now },
  };
}

/**
 * 지금 곡에 대해 보낼 종료 보고. 하차·강제 종료에서도 같은 것을 쓴다.
 *
 * 하차 때 마지막 곡을 안 보내면 **그 곡만 청취시간이 0** 으로 남는다 — 곡을 여러 번 바꾼 뒤
 * 내리면 앞 곡들은 다 남았는데 마지막 것만 비는, 알아채기 어려운 구멍이 된다.
 */
export function endOf(rec: SongRecord | null, now: number): PlayEndRequest | null {
  if (!rec || rec.playHistoryId == null) return null;
  const elapsed = now - rec.songStartedAt;
  return { playHistoryId: rec.playHistoryId, playedMs: Math.max(0, Math.min(Math.round(elapsed), PLAY_END.maxMs)) };
}
