import { STORAGE_KEYS } from "@/constants";
import { readStorage } from "@/lib/storage";

export type AnalyticsEnvironment = "development" | "production";
export interface AnalyticsRuntimePolicy {
  environment: AnalyticsEnvironment;
  logLocal: boolean;
  sendExternal: boolean;
}

/** 브라우저별 분석 스위치. 값이 없으면 일반 사용자 기본값인 ON이다. */
export function analyticsEnabled(): boolean {
  return readStorage<boolean>(STORAGE_KEYS.analyticsMode) !== false;
}

/** GA4 DebugView는 명시적으로 켠 브라우저만 사용한다. 값이 없으면 운영 이벤트다. */
export function analyticsDebugEnabled(): boolean {
  return readStorage<boolean>(STORAGE_KEYS.analyticsDebug) === true;
}

/** localhost 계열만 개발 데이터로 분리하고, 배포 호스트는 운영 데이터로 분류한다. */
export function analyticsEnvironment(hostname: string): AnalyticsEnvironment {
  return ["localhost", "127.0.0.1", "[::1]"].includes(hostname) ? "development" : "production";
}

/** 호스트·데이터·브라우저 스위치만으로 실행 정책을 결정한다. */
export function analyticsRuntimePolicy(
  hostname: string,
  dataSource: "live" | "mock",
  enabled: boolean,
): AnalyticsRuntimePolicy {
  const environment = analyticsEnvironment(hostname);
  return {
    environment,
    logLocal: enabled && environment === "development",
    sendExternal: enabled && dataSource === "live",
  };
}
