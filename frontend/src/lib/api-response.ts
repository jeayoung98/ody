import { NextResponse } from "next/server";
import type { ApiErrorCode } from "@/types";

/**
 * 목 API 라우트가 백엔드와 **같은 응답 봉투**로 답하도록 하는 헬퍼 (API 명세서 §0.2).
 * 실제 백엔드가 붙으면 이 파일과 src/app/bff/ 는 통째로 사라진다.
 */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data, error: null }, { status });
}

export function fail(code: ApiErrorCode, message: string, status: number) {
  return NextResponse.json({ success: false, data: null, error: { code, message } }, { status });
}

/**
 * 이 응답이 **배포 백엔드를 실제로 불러서** 나온 것임을 표시하는 헤더.
 * 브라우저 통로(`lib/api.ts`)가 이걸 보고 콘솔에 찍을지 정한다 — 목 응답에는 달지 않는다.
 * 같은 오리진이라 브라우저에서 그대로 읽힌다.
 */
export const LIVE_HEADERS = { source: "x-ody-source", upstream: "x-ody-upstream" } as const;

function markLive(res: NextResponse, upstream: string) {
  res.headers.set(LIVE_HEADERS.source, "live");
  res.headers.set(LIVE_HEADERS.upstream, upstream);
  return res;
}

/** 배포 백엔드에서 받아온 성공 응답. `upstream` 은 실제로 부른 백엔드 경로다 */
export function okLive<T>(data: T, upstream: string) {
  return markLive(ok(data), upstream);
}

/**
 * 배포 백엔드 호출이 실패했다. **목으로 조용히 대체하지 않는다** —
 * 실패를 감추면 실데이터인 줄 알고 빈 화면을 보게 된다.
 */
export function failLive(code: ApiErrorCode, message: string, status: number, upstream: string) {
  return markLive(fail(code, message, status), upstream);
}
