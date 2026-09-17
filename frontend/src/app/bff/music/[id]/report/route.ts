import { REPORT_DETAIL_MAX, REPORT_REASONS } from "@/constants";
import { failLive, okLive } from "@/lib/api-response";
import { backendPost, BackendError } from "@/lib/backend";

interface BackendReportResponse {
  reportId: number;
}

const REASONS = new Set<string>(REPORT_REASONS.map((r) => r.value));

/**
 * POST /bff/music/{id}/report — 곡 신고 (S15P21A405-377 · 378 · 394).
 *
 * **실연동이다** (2026-09-17, BACKEND-NOTES A-28). 배포 스웨거 `POST /api/music/report`:
 * `{ musicId, reason: "spoken"|"noise"|"other", detailReason? }` → `{ reportId }`.
 *
 * 백엔드는 곡을 **경로가 아니라 본문**으로 받는다. 프론트 경로(`/bff/music/{id}/report`)는
 * 그대로 두고 여기서 옮겨 담는다 — 그 번역이 BFF 가 있는 이유다. 프론트 호출부는 백엔드가
 * 경로를 어떻게 잡았는지 몰라도 된다.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const musicId = Number(id);
  const upstream = "/api/music/report"; // try 밖 — catch 에서도 쓴다
  if (!Number.isInteger(musicId) || musicId < 1) return failLive("VALIDATION_ERROR", "곡 ID 가 올바르지 않습니다.", 400, upstream);

  let body: { reason?: unknown; detailReason?: unknown };
  try {
    body = await req.json();
  } catch {
    return failLive("INVALID_INPUT", "요청 본문이 JSON 이 아닙니다.", 400, upstream);
  }

  /**
   * 사유를 여기서 한 번 더 본다. 백엔드가 `spoken|noise|other` 패턴으로 막고 있지만, 거기서
   * 걸리면 사용자는 까닭 모를 실패만 본다 — 잘못 보낸 것을 보낸 쪽에서 아는 편이 낫다.
   */
  const reason = typeof body.reason === "string" ? body.reason : "";
  if (!REASONS.has(reason)) return failLive("VALIDATION_ERROR", "신고 사유가 올바르지 않습니다.", 400, upstream);

  const detailReason = typeof body.detailReason === "string" ? body.detailReason.trim() : "";
  if (detailReason.length > REPORT_DETAIL_MAX) return failLive("VALIDATION_ERROR", "상세 사유가 너무 깁니다.", 400, upstream);

  try {
    // 빈 문자열은 아예 빼고 보낸다 — 백엔드에서 "적었는데 비었다" 와 "안 적었다" 가 갈린다
    const res = await backendPost<BackendReportResponse>(upstream, { musicId, reason, ...(detailReason ? { detailReason } : {}) });
    return okLive(res, upstream);
  } catch (e) {
    const err = e as BackendError;
    return failLive("INTERNAL_ERROR", err.message, err.status || 502, upstream);
  }
}
