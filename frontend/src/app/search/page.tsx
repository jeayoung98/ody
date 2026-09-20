import AuthGuard from "@/components/auth/auth-guard";
import SearchScreen from "@/components/layout/search-screen";

/**
 * 검색 전용 화면 (SEARCH-01, S15P21A405-417).
 * 좁은 화면에서 지도 위 검색 알약을 누르면 여기로 온다 — 데스크톱은 알약이 그 자리에서 펼쳐진다.
 */
export default function SearchPage() {
  return (
    <AuthGuard>
      <SearchScreen />
    </AuthGuard>
  );
}
