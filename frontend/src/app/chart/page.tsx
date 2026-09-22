import PanelScreen from "@/components/layout/panel-screen";
import ChartPanel from "@/components/panels/chart/chart-panel";

/**
 * 랭킹 탭 (SOCIAL-12, S15P21A405-417). **좁은 화면에서만 온다** — 데스크톱은 같은
 * 컴포넌트를 우측 패널로 연다.
 */
export default function ChartPage() {
  return (
    <PanelScreen panel="chart">
      <ChartPanel />
    </PanelScreen>
  );
}
