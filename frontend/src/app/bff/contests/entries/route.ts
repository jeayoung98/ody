import { CONTEST_LEADERBOARD_SIZE, SKETCH_RULES } from "@/constants";
import { fail, okLive } from "@/lib/api-response";
import { backendGet, backendPatch, backendPost, callerAuth } from "@/lib/backend";
import { artworkFail, toEntry, toRound, type BackendArtworkRound, type BackendArtworkSummary } from "@/lib/contest-bff";
import type { ContestLeaderboard, ContestSubmitResult } from "@/types";

const LEADERBOARD = "/api/artwork/leaderboard";
const CREATE_PLAYLIST = "/api/playlist/create";
const RENAME_PLAYLIST = "/api/playlist/update";
const SUBMIT = "/api/artwork/submit";

interface BackendLeaderboard {
  round: BackendArtworkRound;
  items: BackendArtworkSummary[];
  page: number;
  size: number;
  totalCnt: number;
}

/**
 * 리더보드 (S15P21A405-640) — `GET /api/artwork/leaderboard?size=50`. `SCORED` 만 온다. 갤러리·순위가 같은 목록을 쓴다.
 * 호출자 토큰이 있으면 `likedByMe` 가 채워진다. 회차 인자 없음 = 열린 회차.
 */
export async function GET(req: Request) {
  const upstream = `${LEADERBOARD}?page=0&size=${CONTEST_LEADERBOARD_SIZE}`;
  try {
    const res = await backendGet<BackendLeaderboard>(upstream, { headers: callerAuth(req) });
    const data: ContestLeaderboard = { round: toRound(res.round), items: res.items.map(toEntry), page: res.page, size: res.size, totalCnt: res.totalCnt };
    return okLive(data, upstream);
  } catch (e) {
    return artworkFail(e, upstream);
  }
}

/**
 * 출품 (S15P21A405-640) — 두 번 부른다. **백엔드 작품은 플레이리스트에서 만들어지기 때문이다** (§6-9 대응표):
 * `POST /api/playlist/create { playlistName, musicIdList }` → `POST /api/artwork/submit { playlistId, closed }`.
 *
 * 몸은 둘 중 하나다.
 * - `{ title, musicIds, closed }` — 그려서 찾은 것. `musicIds` 는 매칭 결과 순서 그대로(= 연결 순서 = 재생 순서). 플리를 새로 만든다
 * - `{ title, playlistId, closed }` — AI 추천 모양(S15P21A405-595). 서버가 이미 만든 플리를 **이름만 바꿔**(`PATCH /api/playlist/update`) 낸다.
 *   다시 만들면 같은 곡의 플리가 둘이 된다
 * 같은 회차에 내 작품이 있으면 서버가 **지우고 새로 만든다** — 점수·좋아요가 초기화된다. 고지는 화면이 한다.
 * 플리 단계가 성공하고 출품이 실패하면 플리만 남는다 — 그 사실을 메시지에 적어 준다.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { title?: unknown; musicIds?: unknown; playlistId?: unknown; closed?: unknown };
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const musicIds = Array.isArray(body.musicIds) ? body.musicIds.filter((n): n is number => Number.isInteger(n) && n > 0) : [];
  const given = typeof body.playlistId === "number" && Number.isInteger(body.playlistId) && body.playlistId > 0 ? body.playlistId : null;
  const { minPoints, maxPoints, titleMax } = SKETCH_RULES;
  if (!title || title.length > titleMax) return fail("VALIDATION_ERROR", `별자리 이름은 1~${titleMax}자여야 합니다.`, 400);
  if (given == null) {
    if (musicIds.length < minPoints || musicIds.length > maxPoints) return fail("VALIDATION_ERROR", `곡은 ${minPoints}~${maxPoints}개여야 합니다.`, 400);
    if (new Set(musicIds).size !== musicIds.length) return fail("VALIDATION_ERROR", "같은 곡이 두 번 들어 있습니다.", 400);
  }

  const auth = { headers: callerAuth(req) };
  let playlistId: number;
  if (given != null) {
    playlistId = given;
    try {
      await backendPatch<unknown>(RENAME_PLAYLIST, { playlistId, playlistName: title }, auth);
    } catch (e) {
      return artworkFail(e, RENAME_PLAYLIST);
    }
  } else {
    try {
      const created = await backendPost<{ playlistId: number }>(CREATE_PLAYLIST, { playlistName: title, musicIdList: musicIds }, auth);
      playlistId = created.playlistId;
    } catch (e) {
      return artworkFail(e, CREATE_PLAYLIST);
    }
  }
  try {
    const res = await backendPost<{ artworkId: number; status: ContestSubmitResult["status"] }>(SUBMIT, { playlistId, closed: body.closed === true }, auth);
    const data: ContestSubmitResult = { artworkId: res.artworkId, status: res.status, playlistId };
    return okLive(data, SUBMIT, 201);
  } catch (e) {
    const res = artworkFail(e, SUBMIT);
    // 플리는 이미 생겼다 — 사용자가 "출품이 됐나" 헷갈리지 않게 그 사실을 붙인다
    const json = (await res.json()) as { error?: { message?: string } };
    if (json.error) json.error.message = `${json.error.message ?? "출품에 실패했습니다."} (플레이리스트 「${title}」은 만들어졌어요)`;
    return new Response(JSON.stringify(json), { status: res.status, headers: res.headers });
  }
}
