"use client";

import { useEffect } from "react";
import { API_ENDPOINTS } from "@/constants";
import { api } from "@/lib/api";

/** 한 탭에서 한 번이면 된다. 사람마다 한 번만 바뀌는 값이라 재시도할 것도 없다 */
let done = false;

/**
 * **로그인하면 내 계정을 공개로 못박는다** (S15P21A405-574).
 *
 * 공개/비공개 계정은 폐지됐다. 그런데 배포 백엔드는 아직 `is_public` 으로 막고 있고
 * (`UserService:49` → 403 `USER_PRIVATE`), 가입 INSERT 가 그 칸을 안 채워 DB 기본값을 타는데
 * **그 값이 `false`** 다. 그래서 들어와 있는 사람들이 전부 비공개로 앉아 있었다 — 지도에는
 * 보이는데(뷰포트는 상세를 안 쓴다) 클릭하면 프로필이 403 이라 따라가기 버튼까지 못 갔다.
 *
 * 탑승 API 자체는 `isPublic` 을 안 본다. 막던 것은 프로필 조회 하나뿐이라, 각자 한 번씩
 * 공개로 바꿔 두면 그걸로 뚫린다.
 *
 * **임시 조치다.** 백엔드가 `USER_PRIVATE` 분기를 걷어내고 기존 행을 backfill 하면
 * (BACKEND-NOTES A-59) 이 훅과 `/bff/user/public` 라우트를 같이 지운다.
 *
 * 실패해도 조용히 넘어간다 — 사용자가 시킨 일이 아니라 우리가 뒤에서 치우는 일이고,
 * 안 되면 그 계정만 예전처럼 굴 뿐 화면이 깨지지는 않는다.
 */
export function useForcePublic(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || done) return;
    done = true;
    void api(API_ENDPOINTS.user.publicVisibility, { method: "PATCH", body: JSON.stringify({ isPublic: true }) }).catch(() => {});
  }, [enabled]);
}
