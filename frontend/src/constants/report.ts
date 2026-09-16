/**
 * 곡 신고 사유 (S15P21A405-377).
 *
 * 지도에 오는 662만 곡 안에는 **음원이 아닌 것**이 섞여 있다 — 말소리만 담긴 트랙, 잡음,
 * 그 밖의 것. 추천 품질을 재는 설문(여정·주변)과는 다른 축이라 따로 받는다: 설문은
 * "이 두 곡이 닮았나" 를 묻고, 이건 "이건 애초에 곡이 아니다" 를 알리는 자리다.
 *
 * **값은 백엔드에 그대로 보낸다.** 화면에 보이는 말과 저장되는 값을 갈라 둔다 — 문구를 다듬을
 * 때마다 데이터가 바뀌면 집계가 끊긴다.
 */
export const REPORT_REASONS = [
  { value: "spoken", label: "말소리", detail: "노래가 아니라 말소리·나레이션이에요" },
  { value: "noise", label: "잡음", detail: "잡음이나 소음만 들려요" },
  { value: "other", label: "기타", detail: "그 밖의 이유예요" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

/** 신고를 보낸 뒤. 무엇을 했는지 알려 주되 화면을 막지 않는다 */
export const REPORT_SENT_NOTICE = "신고를 보냈어요. 검토에 참고할게요";
/**
 * 전송이 실패했을 때. **백엔드가 아직 없어서** 목 라우트가 받고 있으므로 지금은 보기 어렵지만,
 * 실연동이 붙은 뒤를 위해 문구를 미리 둔다 (BACKEND-NOTES A-23).
 */
export const REPORT_FAILED_NOTICE = "신고를 보내지 못했어요. 잠시 후 다시 시도해 주세요";
