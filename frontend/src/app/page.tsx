import AuthGuard from "@/components/auth/auth-guard";
import MainScreen from "@/components/layout/main-screen";
import TutorialGate from "@/components/tutorial/tutorial-gate";

export default function HomePage() {
  return (
    <AuthGuard>
      <TutorialGate />
      <MainScreen />
    </AuthGuard>
  );
}
