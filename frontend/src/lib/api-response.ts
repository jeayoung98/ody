import { NextResponse } from "next/server";
import type { ApiErrorCode } from "@/types";

/**
 * 목 API 라우트가 백엔드와 **같은 응답 봉투**로 답하도록 하는 헬퍼 (API 명세서 §0.2).
 * 실제 백엔드가 붙으면 이 파일과 src/app/api/ 는 통째로 사라진다.
 */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data, error: null }, { status });
}

export function fail(code: ApiErrorCode, message: string, status: number) {
  return NextResponse.json({ success: false, data: null, error: { code, message } }, { status });
}
