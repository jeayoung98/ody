import { LAYER_SONG_COUNT } from "@/constants";
import { failLive, ok } from "@/lib/api-response";
import { backendGet, BackendError, isBackendEnabled, toResidentPoint, type BackendMapPoint } from "@/lib/backend";
import { okLiveGzip } from "@/lib/gzip-json";
import { allSongs } from "@/mocks/songs";
import type { MapPoint } from "@/types";

/**
 * `/api/music/major` 응답 (정본 §3.4). 원소는 **곡 요약이 아니라 지도 점**이다 —
 * 2026-09-12 배포 스펙(`/api/v3/api-docs` MapPoint)에서 확인했다.
 */
interface BackendMajorResponse {
  content: BackendMapPoint[];
}

/**
 * 이 겹의 상주 집합 (PC 16개 포함). 실서비스 `GET /music/major` 의 목이다 (BACKEND-NOTES A-1).
 *
 * `BACKEND_ACCESS_TOKEN` 이 있으면 배포 백엔드로 넘긴다.
 * **지도와 주변 탐색·경로 탐색은 반드시 같은 출처여야 한다** — 지도만 목이면 탐색 결과의
 * 곡 ID 가 지도에 없거나, 더 나쁘게는 숫자만 겹쳐 엉뚱한 별에 매칭된다 (BACKEND-NOTES B-22).
 * 쿼리는 손대지 않고 그대로 넘긴다 — 겹마다 좁혀 온 누적 범위를 백엔드 MajorQuery 가 그대로 받는다.
 *
 * 목으로 답할 때: `level` 은 1-based (레이어 0 = level 1), 축 번호도 1-based 라 level n 의 평면은
 * pc(2n-1)·pc(2n) 이다. level>=2 는 이전 겹들에서 좁힌 범위를 `pc{k}min` / `pc{k}max` 로 level-1 쌍 전부 받는다.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;

  if (isBackendEnabled()) {
    const qs = q.toString();
    const upstream = `/api/music/major?${qs || "level=1"}`;
    try {
      const res = await backendGet<BackendMajorResponse>(upstream);
      // 1겹은 1,576KB 라 압축해서 보낸다 (S15P21A405-680). 파고든 겹(약 270KB)도 같은 길을 탄다
      return await okLiveGzip(req, res.content.map(toResidentPoint), upstream);
    } catch (e) {
      const err = e as BackendError;
      return failLive("INTERNAL_ERROR", err.message, err.status || 502, upstream);
    }
  }

  const level = Math.max(1, Math.round(Number(q.get("level") ?? 1)) || 1);
  // 레이어 0 = 전 우주. 범위 조건이 없어 결과가 늘 같다 (실서비스도 미리 계산해 둔 정적 집합이다)
  if (level === 1) return ok(topLevelSongs());

  const num = (key: string, fallback: number) => {
    const raw = q.get(key);
    const v = raw == null ? NaN : Number(raw);
    return Number.isFinite(v) ? v : fallback;
  };
  // 누적 범위: 레이어 0..level-2 (= 1-based level 1..level-1)
  const boxes = Array.from({ length: level - 1 }, (_, layer) => {
    const k = layer * 2 + 1;
    return {
      d: layer * 2,
      xMin: num(`pc${k}min`, -Infinity),
      xMax: num(`pc${k}max`, Infinity),
      yMin: num(`pc${k + 1}min`, -Infinity),
      yMax: num(`pc${k + 1}max`, Infinity),
    };
  });

  /**
   * ponytail: 목의 우주가 한 겹의 네 배(SONG_COUNT)뿐이라 두세 겹만 내려가도 범위 안 곡이 마른다.
   * 범위 밖이라도 **가까운 순으로 채워** 한 겹 규모를 유지한다 — 실서비스는 662만 곡 중에서 고르니
   * 이 보정이 필요 없다. 서버 구현을 이대로 베끼지 말 것 (범위 밖 곡을 섞으면 FR-008 누적이 깨진다).
   */
  const outside = (s: MapPoint) =>
    boxes.reduce((sum, b) => sum + gap(s.pc[b.d], b.xMin, b.xMax) + gap(s.pc[b.d + 1], b.yMin, b.yMax), 0);

  const resident = allSongs()
    .filter((s) => !s.ghostOnly) // 고스트 확인용 곡은 레이어 0 에만 있다
    .map((s) => ({ s, out: outside(s) }))
    .sort((a, b) => a.out - b.out || b.s.weight - a.s.weight)
    .slice(0, LAYER_SONG_COUNT)
    .map((x) => x.s);

  return ok(resident);
}

/** 범위 밖으로 벗어난 거리 (범위 안이면 0) */
function gap(v: number, lo: number, hi: number) {
  return v < lo ? lo - v : v > hi ? v - hi : 0;
}

let topLevel: MapPoint[] | null = null;
/** 레이어 0 상주 집합 — 재생수 상위 한 겹 + 확인용 고스트곡 (이 곡은 여기에만 있다) */
function topLevelSongs(): MapPoint[] {
  if (topLevel) return topLevel;
  const all = allSongs();
  const ghost = all.filter((s) => s.ghostOnly);
  topLevel = [
    ...all
      .filter((s) => !s.ghostOnly)
      .slice()
      .sort((a, b) => b.weight - a.weight)
      .slice(0, LAYER_SONG_COUNT - ghost.length),
    ...ghost,
  ];
  return topLevel;
}
