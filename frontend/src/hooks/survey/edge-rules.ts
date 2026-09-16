import type { SurveyEdge, SurveySong } from "@/types/survey";

/**
 * 간선 판정 (S15P21A405-335). **설문에서 케이스가 갈리는 곳은 여기뿐이다.**
 *
 * 설문 1건 = 알고리즘이 제안한 간선 하나를 사용자가 실제로 밟았는가. 주변 탐색이든 경로
 * 탐색이든, 둘을 오가든, 판정은 곡 하나가 재생될 때 이 두 함수 중 하나로 끝난다.
 *
 * **React 를 모른다.** 순수 함수라 `edge-rules.check.ts` 가 그대로 돌려볼 수 있다 —
 * 케이스가 많아서 눈으로 좇는 것으로는 부족하다.
 */

/** 밟은 자취. `use-survey-store` 가 들고 있는 값 그대로다 */
export interface Trail {
  /** 소리가 난 적 있는 곡 */
  played: ReadonlySet<number>;
  /** 마지막으로 소리가 난 곡 */
  lastPlayed: number | null;
  /** 재생하려 했지만 `videoId` 가 없어 한 음도 못 들려준 곡 */
  unplayable: ReadonlySet<number>;
}

/**
 * 주변 탐색 — 기준곡 A 에서 이웃 x 로 가는 간선.
 *
 * **비교 상대는 늘 기준곡이고, 그것이 직전 곡일 필요는 없다** (결정 1). 주변 탐색은 A 에 서서
 * 이웃을 하나씩 들어보는 정찰이라 기준이 안 움직인다. 직전 곡을 요구하면 A→B 만 성립하고
 * A→C·A→D 는 영영 못 묻는다 — 10곡 들려주고 1건을 받는 꼴이다.
 *
 * 기준곡을 한 번도 안 들었으면(선택만 했으면) 그 탐색의 간선은 전부 무효다 — 비교할 소리가
 * 사용자에게 없다.
 */
export function nearbyEdge(
  musicId: number,
  trail: Trail,
  list: { sessionId: string; center: SurveySong; neighbors: readonly SurveySong[] },
): SurveyEdge | null {
  const { sessionId, center, neighbors } = list;
  const i = neighbors.findIndex((n) => n.musicId === musicId);
  if (i < 0) return null;
  // 기준곡을 들어봤어야 비교가 성립한다
  if (!trail.played.has(center.musicId)) return null;
  // 들려주지 못한 곡은 추천 품질과 무관하다 — 묻지도, 행을 남기지도 않는다
  if (trail.unplayable.has(center.musicId) || trail.unplayable.has(musicId)) return null;
  return {
    target: { sessionId, mode: "nearby", rank: i + 1, anchorMusicId: center.musicId, musicId },
    subject: neighbors[i],
    compare: center,
  };
}

/**
 * 경로 탐색 — 앞 역에서 이 역으로 오는 간선.
 *
 * **비교 상대는 직전에 소리가 난 곡이어야 한다** (결정 2). "이어졌나" 는 방향이 있는 질문이라,
 * 그 전환을 실제로 그 순서로 겪지 않았으면 물을 것이 없다.
 *
 * 사이에 낀 역을 보는 한 줄이 네 경우를 한꺼번에 가른다.
 *
 * | 사이에 낀 역 | 뜻 | 결과 |
 * |---|---|---|
 * | 0곡 | 인접 — 알고리즘이 고른 간선 그대로 | 묻는다 |
 * | 전부 재생 불가 | 못 들려준 역은 없는 셈 치고 이어붙인다 (A→C) | 묻는다 |
 * | 멀쩡한 곡이 하나라도 | 사용자가 건너뛰었다 (A→D) | 안 묻는다 |
 * | `j <= i` | 역순으로 재생했다 | 안 묻는다 |
 *
 * 건너뛰기·역순을 기록하지 않는 이유는 알고리즘이 **제안하지 않은 전환**이기 때문이다.
 * 고른 간선은 1→2·2→3 뿐인데 1→3 에 점수를 매기면 하지도 않은 일을 채점하는 꼴이 된다.
 */
export function journeyEdge(
  musicId: number,
  trail: Trail,
  list: { sessionId: string; stops: readonly SurveySong[] },
): SurveyEdge | null {
  const { sessionId, stops } = list;
  if (stops.length < 2) return null;
  // 출발곡(step 0)은 앞 역이 없어 평가 대상이 아니다
  const j = stops.findIndex((s) => s.musicId === musicId);
  if (j < 1) return null;
  const i = trail.lastPlayed == null ? -1 : stops.findIndex((s) => s.musicId === trail.lastPlayed);
  if (i < 0 || j <= i) return null;
  if (!stops.slice(i + 1, j).every((s) => trail.unplayable.has(s.musicId))) return null;
  if (trail.unplayable.has(musicId)) return null;
  return {
    target: {
      sessionId,
      mode: "journey",
      rank: j,
      anchorMusicId: stops[0].musicId,
      targetMusicId: stops[stops.length - 1].musicId,
      prevMusicId: stops[i].musicId,
      musicId,
    },
    subject: stops[j],
    compare: stops[i],
  };
}
