import PanelScreen from "@/components/layout/panel-screen";
import FriendsPanel from "@/components/panels/friends/friends-panel";

/**
 * 주변 사람 탭 (SOCIAL-01, S15P21A405-417). **좁은 화면에서만 온다** — 데스크톱은 같은
 * 컴포넌트를 우측 패널로 연다. 지도는 이 화면 아래에 살아 있다 (`app-shell.tsx`).
 */
export default function FriendsPage() {
  return (
    <PanelScreen panel="friends">
      <FriendsPanel />
    </PanelScreen>
  );
}
