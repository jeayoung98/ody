import { fail, okLive } from "@/lib/api-response";
import { backendGet, backendPost, callerAuth, type BackendPlaylistDetailResponse } from "@/lib/backend";
import { artworkFail } from "@/lib/contest-bff";
import { templateScore } from "@/lib/contest-view";
import type { ContestMatch, ContestTrack } from "@/types";

const GENERATE = "/api/artwork/generate";

interface BackendGenerate {
  playlistId: number;
  playlistName: string;
  template: string;
  musicCnt: number;
  fitError: number;
  points: { musicId: number; x: number; y: number }[];
}

/**
 * AI 추천 모양으로 별자리 만들기 (S15P21A405-595) — `POST /api/artwork/generate { template }`.
 *
 * **서버가 플레이리스트를 만든다** (이름 `고양이 <라벨> <HHmmss>`, 중복 없음). 출품은 하지 않는다 — 재출품 시 점수가 사라지는
 * 정책과 부딪히지 않게 사용자가 결정한다. 응답 `points` 에는 곡 이름이 없어서 방금 만든 플리 상세를 한 번 더 읽어 채운다 —
 * 화면이 곡 목록을 보여 줘야 "이 곡들로 출품한다" 를 알고 누른다.
 * 몸: `{ template, label }`. `label` 은 화면 표시용으로 되돌려 줄 뿐이다.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { template?: unknown; label?: unknown };
  const template = typeof body.template === "string" ? body.template.trim() : "";
  if (!template) return fail("VALIDATION_ERROR", "template 이 필요합니다.", 400);
  const auth = { headers: callerAuth(req) };

  let gen: BackendGenerate;
  try {
    gen = await backendPost<BackendGenerate>(GENERATE, { template }, auth);
  } catch (e) {
    return artworkFail(e, GENERATE);
  }

  // 곡 이름 채우기 — 실패해도 별자리는 낼 수 있으니 이름만 비워 둔다
  const names = new Map<number, { title: string; artist: string | null }>();
  try {
    const detail = await backendGet<BackendPlaylistDetailResponse>(`/api/playlist/detail?playlistId=${gen.playlistId}`, auth);
    for (const m of detail.musics) names.set(m.id, { title: m.title, artist: m.artist ?? null });
  } catch {
    /* 이름 없이 진행 */
  }

  const tracks: ContestTrack[] = gen.points.map((p) => ({ musicId: p.musicId, x: p.x, y: p.y, title: names.get(p.musicId)?.title ?? null, artist: names.get(p.musicId)?.artist ?? null }));
  const data: ContestMatch = {
    ...templateScore(gen.fitError),
    tracks,
    template: { name: gen.template, label: typeof body.label === "string" ? body.label : gen.template, playlistId: gen.playlistId, playlistName: gen.playlistName, fitError: gen.fitError },
  };
  return okLive(data, GENERATE, 201);
}
