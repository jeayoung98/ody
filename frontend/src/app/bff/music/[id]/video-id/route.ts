import { failLive, okLive } from "@/lib/api-response";
import { backendPost, BackendError } from "@/lib/backend";
import type { VideoIdLookup } from "@/types";

interface BackendVideoIdBatch {
  items?: { musicId: number; videoId: string | null }[];
}

/**
 * 백엔드가 **검색해봤는데 없었다**를 알리는 값 (S15P21A405-332).
 *
 * `null` 은 아직 검색 전이라는 뜻이라 **의미가 다르다.** 그런데 둘 다 "영상 없음" 으로 뭉개면
 * 다시 부를 곡과 기다려도 안 될 곡이 같아진다. 게다가 `"none"` 은 빈 문자열이 아니라서
 * 예전 `found || null` 식을 그대로 통과했다 — 프론트가 영상이 있다고 믿고 `loadVideoById("none")`
 * 을 걸었고, 유튜브가 그런 영상을 못 찾아 **소리도 안 나고 안내도 없었다.**
 */
const NOT_FOUND = "none";

/**
 * GET /bff/music/{id}/video-id — 곡 하나의 `videoId` (SONG-03).
 *
 * 백엔드는 `POST /api/music/videoid` 로 **목록**을 받지만, 여기서는 **언제나 한 곡만** 보낸다.
 * 그 조회는 DB 에 없으면 외부 videoId API 를 호출해 채운 뒤 저장하는 동작이라, 여러 곡을 한꺼번에
 * 치면 그만큼 외부 호출이 붙는다. 그래서 **곡 상세를 여는 그 순간 그 곡만** 부른다
 * (2026-09-15 사용자 지정, S15P21A405-340).
 *
 * 곡 상세(`/api/music/detail`) 응답에도 `videoId` 가 딸려 오지만 그걸 쓰지 않는다 — 그 응답은
 * 주변 10곡 것까지 함께 싣고 있어서, 백엔드가 그 필드를 빼는 순간 프론트가 깨진다.
 * 전용 엔드포인트가 유일한 출처여야 그 변경에 안 흔들린다.
 *
 * 목이 없다. `videoId` 는 백엔드만 알 수 있으므로 실패하면 실패로 답한다.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const musicId = Number(id);

  const upstream = "/api/music/videoid";
  try {
    const data = await backendPost<BackendVideoIdBatch>(upstream, { musicIds: [musicId] });
    // 한 곡만 보냈으므로 답도 한 줄이다. 곡 자체가 없으면 items 가 비어 온다 — 그것도 "아직 모름" 이다
    const raw = data.items?.find((v) => v.musicId === musicId)?.videoId ?? null;
    // 빈 문자열은 `"none"` 과 같게 본다 — 검색 결과가 비었다는 뜻이다
    const lookup: VideoIdLookup = raw === NOT_FOUND || raw === "" ? "notFound" : raw ? "found" : "unsearched";
    return okLive({ musicId, videoId: lookup === "found" ? raw : null, lookup }, upstream);
  } catch (e) {
    const err = e as BackendError;
    return failLive("INTERNAL_ERROR", err.message, err.status || 502, upstream);
  }
}
