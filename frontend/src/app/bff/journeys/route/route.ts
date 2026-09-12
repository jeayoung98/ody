import { fail, failLive, ok, okLive } from "@/lib/api-response";
import { backendGet, BackendError, isBackendEnabled, toPcArray, type BackendJourneyResponse } from "@/lib/backend";
import { mockJourney } from "@/mocks/music";
import type { JourneyRoute } from "@/types";

/** 백엔드 `GET /api/music/journey` 응답 → 화면이 쓰는 JourneyRoute */
function toJourneyRoute(res: BackendJourneyResponse, startId: number, endId: number): JourneyRoute {
  return {
    startMusicId: startId,
    endMusicId: endId,
    totalDuration: res.totalDuration,
    stops: res.path.map((stop) => ({
      id: stop.id,
      title: stop.title,
      artist: stop.artist,
      duration: stop.duration,
      // 엔진이 주는 step 은 최종 목록 기준 0부터 1씩 증가하는 연속값이다
      order: stop.step,
      genreName: stop.genres?.[0] ?? null,
      pc: toPcArray(stop.location),
    })),
  };
}

/**
 * GET /bff/journeys/route?start=<musicId>&end=<musicId>
 *
 * `BACKEND_ACCESS_TOKEN` 이 있으면 배포 백엔드의 `/api/music/journey` 를 대신 호출한다.
 * 없으면 목 경로를 준다 — 목은 `mocks/songs.ts` 의 곡 ID 를 쓰므로 지도와 ID 가 맞는다.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const start = Number(sp.get("start"));
  const end = Number(sp.get("end"));
  if (!start || !end) return fail("VALIDATION_ERROR", "start' end' 파라미터가 필요합니다.", 400);

  if (!isBackendEnabled()) return ok(mockJourney(start, end));

  const upstream = `/api/music/journey?start=${start}&end=${end}`;
  try {
    const res = await backendGet<BackendJourneyResponse>(upstream);
    return okLive(toJourneyRoute(res, start, end), upstream);
  } catch (e) {
    const err = e as BackendError;
    return failLive("PATH_NOT_FOUND", err.message, err.status || 502, upstream);
  }
}
