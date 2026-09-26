"use client";

import { useSyncExternalStore } from "react";
import { STORAGE_KEYS } from "@/constants";
// 배럴(@/constants)이 아니라 정의 파일에서 직접 받는다 — 테스트가 env 를 바꿔 다시 읽을 수 있어야 한다
import { TEST_TOOLS } from "@/constants/test-tools";
import { readStorage } from "@/lib/storage";

/**
 * 설문 모드 — **브라우저마다 따로 끄는 스위치** (S15P21A405-383).
 *
 * [`TEST_TOOLS`](../constants/test-tools.ts) 는 빌드 시각에 박히는 값이라 배포한 뒤에는 못 바꾼다.
 * 그래서 설문을 배포해 두고 계속 개발하려면 설문 시점 브랜치를 얼려야 했는데, 나중에 합칠 때
 * 충돌하는 게 지도·패널·튜토리얼 같은 화면 코드라 제일 아픈 종류다.
 *
 * 대신 한 브랜치·한 빌드로 가고 **보는 사람이 자기 브라우저에서 모드를 뒤집는다.**
 *
 * **기본은 꺼짐이다** (S15P21A405-696). 예전에는 기본이 설문 모드라 팀원이 `false` 를 넣어 껐는데, 이제는
 * 설문을 보여 줄 테스터 쪽이 켠다 — 테스터에게 보내는 링크는 `?dev=0` 이다(`constants/dev-mode.ts`).
 *
 * ```js
 * localStorage.setItem("ody:survey-mode", "true"); location.reload();   // 설문으로
 * localStorage.removeItem("ody:survey-mode");      location.reload();   // 개발 버전으로 (기본)
 * ```
 *
 * **빌드 스위치가 이긴다.** `TEST_TOOLS` 가 꺼진 최종 배포에서는 로컬 값이 뭐든 설문이 없다 —
 * 설문 코드 자체가 그 빌드에 실리지 않는 게 목표라, 로컬스토리지로 되살릴 수 있으면 안 된다.
 *
 * **이 값이 가르는 것은 설문(과 테스트 안내 화면)뿐이다** (S15P21A405-480). 예전에는 기능 표시와
 * 로그인 게이트까지 같이 갈랐다 — 테스터는 계정 없이 탐색만 보고, 모드를 끈 팀원은 로그인하고
 * 전부 봤다(S15P21A405-333·459). 이제 테스트 모드에서도 로그인하고 나머지 기능을 그대로 쓴다.
 *
 * 값을 렌더 중에 바로 읽지 않는 이유: 서버에는 localStorage 가 없어서 서버가 그린 HTML 과
 * 달라지면 하이드레이션이 깨진다. `getServerSnapshot` 으로 양쪽 첫 렌더를 기본값에 맞춰 두고,
 * 하이드레이션이 끝난 뒤 React 가 실제 값으로 다시 그린다 (`auth-guard` 의 `useHasToken` 과 같다).
 */

/** 저장소는 이 세션 안에서 바뀌지 않는다 — 바꾼 사람은 새로고침한다 */
const noopSubscribe = () => () => {};

/** 브라우저에서 본 실제 값. **`true` 를 넣었을 때만 켜진다** — 저장소가 막혀 있으면 `readStorage` 가 null 을 주므로 꺼진다 */
export function surveyModeEnabled(): boolean {
  return TEST_TOOLS && readStorage<boolean>(STORAGE_KEYS.surveyMode) === true;
}

/** 서버 첫 렌더도 기본값(꺼짐)이다 — 켠 사람만 하이드레이션 뒤 설문으로 다시 그린다 */
export function useSurveyMode(): boolean {
  return useSyncExternalStore(noopSubscribe, surveyModeEnabled, () => false);
}
