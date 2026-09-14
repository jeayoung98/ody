import { fail, failLive, okLive } from "@/lib/api-response";
import { backendPost, BackendError } from "@/lib/backend";
import type { ConstellationLayout } from "@/types";

/**
 * POST /bff/constellations/layout — 별자리 배치 (PATH-01).
 *
 * 좌표를 만드는 곳은 **백엔드 하나뿐이다** (서빙 baseline, S15P21A405-278). 여기서는 계산하지
 * 않고 그대로 전달만 한다 — 보내는 쪽마다 모양이 달라지면 같은 플리를 두 사람이 다르게 본다.
 *
 * **rewrite 로 흘려보내지 않고 이 라우트를 거치는 이유** (S15P21A405-303):
 * rewrite 는 브라우저가 보낸 `Origin` 을 그대로 백엔드에 전달하는데, 백엔드 CORS 허용 목록에
 * 없는 오리진은 `403 Invalid CORS request` 로 막힌다. 로컬(`http://localhost:3000`)이 그래서
 * 403 이었고, 배치가 영영 안 와서 지도에 별자리가 아예 안 그려졌다. 배포는 페이지 오리진이
 * 백엔드와 같아 드러나지 않았다. 라우트 핸들러는 Next 서버가 새 요청을 띄우므로 `Origin` 이
 * 안 붙고, 그래서 로컬·배포 양쪽에서 똑같이 동작한다.
 *
 * 목이 없다. 배치는 백엔드만 만들 수 있으므로 실패하면 실패로 답한다.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { musicIds?: number[] };
  if (!body.musicIds?.length) return fail("VALIDATION_ERROR", "musicIds 가 필요합니다.", 400);

  const upstream = "/api/constellations/layout";
  try {
    const data = await backendPost<ConstellationLayout>(upstream, { musicIds: body.musicIds });
    return okLive(data, upstream);
  } catch (e) {
    const err = e as BackendError;
    return failLive("INTERNAL_ERROR", err.message, err.status || 502, upstream);
  }
}
