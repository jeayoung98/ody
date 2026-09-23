import { ok } from "@/lib/api-response";

/**
 * ⚠ **목이다. 배포 API 에 이 기능이 없다** (BACKEND-NOTES A-36, 2026-09-18 스펙 34개 경로 대조).
 * 지우지 않고 남긴 이유: 화면·훅은 이미 다 있어서, 백엔드가 생기면 이 파일만 바꾸면 된다.
 * **여기서 나온 값을 지표나 시연의 근거로 쓰면 안 된다.**
 */
/** 재생 로그 기록 (play_history). 목에서는 성공만 반환 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return ok({ ok: true, musicId: Number(id) });
}
