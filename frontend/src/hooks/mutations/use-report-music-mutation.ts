import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, type ReportReason } from "@/constants";

interface ReportMusicInput {
  musicId: number;
  reason: ReportReason;
}

/**
 * 곡 신고 (S15P21A405-377).
 *
 * 지금은 목 라우트가 받는다 — 백엔드에 API 가 아직 없다 (BACKEND-NOTES A-23).
 * 실연동이 붙어도 이 훅은 그대로고 라우트 핸들러만 바뀐다.
 */
export function useReportMusicMutation() {
  return useMutation({
    mutationFn: ({ musicId, reason }: ReportMusicInput) =>
      api<{ reportId: number }>(API_ENDPOINTS.music.report(musicId), { method: "POST", body: JSON.stringify({ reason }) }),
  });
}
