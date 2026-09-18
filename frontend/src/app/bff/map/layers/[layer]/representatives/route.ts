import { failLive, okLive } from "@/lib/api-response";
import { backendGet, BackendError, type BackendMapPoint } from "@/lib/backend";

/**
 * 한 겹에서 커버로 띄울 곡 수. 목이 쓰던 수(40)를 그대로 가져왔다 — 화면에 몇 개가 뜨는지는
 * 지도 엔진이 겹 배율로 다시 고르므로 여기서는 후보만 넉넉히 준다.
 */
const PER_LAYER = 40;

/**
 * 레이어별 대표곡 ID — **배포 백엔드 실연동** (S15P21A405-468).
 *
 * 예전에는 목 곡 ID 를 줬다. 지도는 실데이터인데 대표곡만 목이면 **숫자만 겹쳐 엉뚱한 별이
 * 대표곡으로 뜬다** — 지도와 탐색이 같은 출처여야 한다는 것과 같은 함정이다 (B-22).
 *
 * 상주 집합에서 재생수(`weight`) 상위로 고른다. 서버 쪽 level 은 1-based 라 레이어 l 은 level l+1 이다.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ layer: string }> }) {
  const layer = Math.max(0, Math.round(Number((await params).layer)) || 0);

  const upstream = `/api/music/major?level=${layer + 1}`;
  try {
    const res = await backendGet<{ content: BackendMapPoint[] }>(upstream);
    const musicIds = (res.content ?? [])
      .slice()
      .sort((a, b) => b.weight - a.weight)
      .slice(0, PER_LAYER)
      .map((p) => p.musicId);
    return okLive({ layer, musicIds }, upstream);
  } catch (e) {
    const err = e as BackendError;
    return failLive("INTERNAL_ERROR", err.message, err.status || 502, upstream);
  }
}
