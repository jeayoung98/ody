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

/** 한 대에서만 도는 주소. 브라우저와 서버가 같은 기계다 */
const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

/** 네 덩이 숫자로만 이루어진 주소. **접두 비교를 하면 `10.example.com` 같은 도메인이 샌다** */
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** 공인 주소로는 나올 수 없는 IPv4 사설 대역인지 */
function isPrivateIPv4(host: string): boolean {
  const parts = IPV4.exec(host);
  if (!parts) return false;
  const a = Number(parts[1]);
  const b = Number(parts[2]);
  return (
    a === 10 || // 10.0.0.0/8
    (a === 192 && b === 168) || // 192.168.0.0/16
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 — 폰 핫스팟이 흔히 여기를 준다
    (a === 169 && b === 254) // 링크 로컬 (DHCP 실패 시)
  );
}

/** IPv6 사설 주소(고유 로컬 `fc00::/7`·링크 로컬 `fe80::`)와 mDNS 이름. 호스트네임에 대괄호가 붙어 온다 */
const PRIVATE_HOST = /^\[f[cd]|^\[fe80:|\.local$/;

/**
 * loopback·사설망만 개발 데이터로 분리하고, 배포 호스트는 운영 데이터로 분류한다.
 *
 * **사설망을 넣는 이유는 폰이다** (S15P21A405-485). 폰에는 개발자도구가 없어서 노트북 LAN
 * 주소로 붙어 확인하는데, 그게 loopback 이 아니라는 이유로 운영으로 찍히면 **개발 중 만든
 * 이벤트가 실제 유저 데이터에 섞인다.**
 */
export function analyticsEnvironment(hostname: string): AnalyticsEnvironment {
  const host = hostname.toLowerCase();
  if (LOOPBACK_HOSTS.includes(host)) return "development";
  return isPrivateIPv4(host) || PRIVATE_HOST.test(host) ? "development" : "production";
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
