import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, type ReportReason } from "@/constants";

interface ReportMusicInput {
  musicId: number;
  reason: ReportReason;
  /** `기타` 를 골랐을 때 적은 말. 다른 사유에는 없다 */
  detailReason?: string;
}

/**
 * 곡 신고 (S15P21A405-377 · 394).
 *
 * 라우트 핸들러가 배포 백엔드 `POST /api/music/report` 를 대신 부른다 (2026-09-17 실연동,
 * BACKEND-NOTES A-28). 백엔드는 곡을 본문으로 받지만 그 번역은 라우트가 맡는다 —
 * 여기서는 프론트 경로만 안다.
 */
export function useReportMusicMutation() {
  return useMutation({
    mutationFn: ({ musicId, reason, detailReason }: ReportMusicInput) =>
      api<{ reportId: number }>(API_ENDPOINTS.music.report(musicId), {
        method: "POST",
        body: JSON.stringify(detailReason ? { reason, detailReason } : { reason }),
      }),
  });
}
