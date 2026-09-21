"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";
import { ROUTES } from "@/constants";

/**
 * 하위 탭 화면에 있으면 **지도 탭으로 돌아간다** (S15P21A405-417). 이미 지도면 아무것도 안 한다.
 *
 * 폰에서 주변 사람·랭킹·마이페이지는 제 경로를 가진 화면이고, 거기서 누른 것들(따라가기,
 * 남의 프로필, 차트의 곡)은 **지도에서 결과가 보인다.** 그 화면에 남아 있으면 무슨 일이
 * 일어났는지 안 보이므로, 누르는 쪽에서 이걸 같이 부른다.
 *
 * 데스크톱은 `/` 하나만 쓰므로 언제나 아무 일도 하지 않는다.
 */
export function useBackToMap() {
  const router = useRouter();
  const pathname = usePathname();
  return useCallback(() => {
    if (pathname !== ROUTES.home) router.push(ROUTES.home);
  }, [pathname, router]);
}
