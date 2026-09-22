import { failLive, okLive } from "@/lib/api-response";
import { backendGet, BackendError } from "@/lib/backend";
import type { LayerUsersSnapshot } from "@/types";

/**
 * 그 겹에서 재생 중인 사람 전부 (S15P21A405-537, BACKEND-NOTES §5) — **실연동**.
 *
 * 소켓 뷰포트 구독과 **목적이 다르다.** 그쪽은 보이는 범위만 주고 칸이 많아지면 "N명" 뭉치로
 * 바꾸는데, 지도는 줌과 상관없이 사람을 전부 한 명씩 그리기로 했다 (팀 결정). 이 조회가 그
 * 결정을 만족시키는 유일한 출처다.
 *
 * **호출자 토큰으로 부른다.** 응답에서 **요청자 본인이 빠지기** 때문에, 서비스 토큰으로 부르면
 * 모두가 같은 한 사람을 뺀 목록을 받는다 — 자기 자신이 지도에 두 번 그려진다.
 * `backendFetch` 가 요청의 Authorization 을 그대로 넘긴다 (S15P21A405-481).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ layer: string }> }) {
  const { layer } = await params;
  const upstream = `/api/realtime/layers/${layer}/users`;
  try {
    return okLive(await backendGet<LayerUsersSnapshot>(upstream), upstream);
  } catch (e) {
    const err = e as BackendError;
    /**
     * **404 를 따로 가른다.** 이 경로는 `realtime` 프로파일에서만 뜨고, 배포에 아직 안 올라간
     * 동안에는 없는 경로다 (2026-09-22 기준 스웨거에 안 보인다). 다른 실패와 뭉쳐 두면
     * "사람이 안 보인다" 가 서버 문제인지 배포 시차인지 구분이 안 된다.
     */
    const code = err.status === 404 ? "NOT_IMPLEMENTED" : err.status === 400 ? "INVALID_INPUT" : "INTERNAL_ERROR";
    return failLive(code, err.message, err.status || 502, upstream);
  }
}
