import Stat from "@/components/common/stat";
import type { ProfileDashboard } from "@/types";

/**
 * [대시보드] 탐험한 곡 수 · 발견한 곡 수 (S15P21A405-524).
 *
 * **제목 글자와 선호 분위기를 뺐다.** 제목은 두 줄짜리 숫자 위에 붙는 라벨이라 없어도 읽히고,
 * 선호 분위기 막대는 자리를 크게 먹는 데 비해 보는 사람이 할 일이 없었다. 화면의 중심을
 * 플리 목록에 주기로 했다.
 */
export default function FeedDashboard({ dashboard }: { dashboard: ProfileDashboard }) {
  /**
   * **모르면 0 이다** (S15P21A405-619). 두 줄은 늘 선다.
   *
   * 예전에는 값이 없으면 줄을 통째로 지웠다 (S15P21A405-531) — 그때는 백엔드에 발견 곡 수가
   * 아예 없어서, 0 을 적으면 "한 곡도 발견 못 했다" 는 **없는 사실**이 됐기 때문이다.
   * 지금은 백엔드가 둘 다 준다 (597). 값이 안 오는 건 그 필드가 없는 옛 배포뿐이고, 그건
   * 곧 **셀 기록이 없다** 는 뜻이라 0 으로 읽는 것이 맞다.
   *
   * 줄이 사라졌다 나타났다 하는 쪽이 더 나쁘다 — 없는 줄은 "아직 안 만든 기능" 으로 읽히고,
   * 프로필마다 줄 수가 달라 무엇을 비교하는 화면인지가 흐려진다.
   */
  const rows = [
    { label: "탐험한 곡 (재생)", value: dashboard.exploredCount ?? 0 },
    { label: "발견한 곡 (처음 재생)", value: dashboard.discoveredCount ?? 0 },
  ];

  return (
    <dl className="m-0">
      {rows.map((r) => (
        <Stat key={r.label} label={r.label} value={`${r.value.toLocaleString()}곡`} numeric />
      ))}
    </dl>
  );
}
