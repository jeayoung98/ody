import AuthGuard from "@/components/auth/auth-guard";
import MainScreen from "@/components/layout/main-screen";
import TutorialEntry from "@/components/tutorial/tutorial-entry";

/**
 * 튜토리얼: 실제 지도 위에 단계별 태스크를 얹는다 (AUTH-04).
 * 테스트 모드면 그 앞에 테스트 안내 화면이 한 장 낀다 (S15P21A405-343).
 */
export default function TutorialPage() {
  return (
    <AuthGuard>
      <MainScreen overlay={<TutorialEntry />} />
    </AuthGuard>
  );
}
