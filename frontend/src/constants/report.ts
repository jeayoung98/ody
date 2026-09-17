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
  /**
   * 음원을 못 찾아 **재생 자체가 안 되는** 곡 (S15P21A405-397).
   *
   * 나머지 셋과 축이 다르다 — 저건 "이건 곡이 아니다" 라는 사람의 판단이고 이건 "들을 수가
   * 없다" 는 사실이다. 그래서 **재생 불가일 때만 보여 준다** (`unplayableOnly`). 들리는 곡에
   * 이 항목이 떠 있으면 잘못 누르게 되고, 그렇게 들어온 신고는 걸러낼 방법이 없다.
   */
  { value: "unplayable", label: "재생 불가", detail: "음원을 찾을 수 없어 재생되지 않아요", unplayableOnly: true },
] as const;

/**
 * 지금 화면에서 고를 수 있는 사유.
 *
 * @param unplayable 그 곡이 **찾아봤는데 없는** 상태인가 (`PLAYBACK_BLOCKED.noVideo`).
 *   아직 안 찾아봤거나(`notSearched`) 조회가 실패한(`lookupFailed`) 것은 **없는 게 아니라
 *   모르는 것**이라 여기서 false 다.
 */
export const reportReasonsFor = (unplayable: boolean) => REPORT_REASONS.filter((r) => unplayable || !("unplayableOnly" in r));

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

/** 상세 사유를 적어야 하는 사유. 무엇이 문제인지 목록만으로는 알 수 없는 것 하나뿐이다 */
export const REPORT_NEEDS_DETAIL: ReportReason = "other";

/** 상세 사유 길이 상한. **백엔드 제약과 같은 값이다** (`MusicReportRequest.detailReason` maxLength) */
export const REPORT_DETAIL_MAX = 2000;

export const REPORT_DETAIL_PLACEHOLDER = "무엇이 문제인지 한 줄로 적어주세요";

/** 신고를 보낸 뒤. 무엇을 했는지 알려 주되 화면을 막지 않는다 */
export const REPORT_SENT_NOTICE = "신고를 보냈어요. 검토에 참고할게요";
/** 전송이 실패했을 때. 실연동이라 진짜로 실패할 수 있다 (2026-09-17, BACKEND-NOTES A-28) */
export const REPORT_FAILED_NOTICE = "신고를 보내지 못했어요. 잠시 후 다시 시도해 주세요";
