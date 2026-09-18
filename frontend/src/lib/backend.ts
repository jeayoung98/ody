/**
 * **서버 전용.** `src/app/bff/` 라우트 핸들러에서만 쓴다 — 브라우저 번들에 들어가면 토큰이 샌다.
 *
 * 로그인이 목이라 브라우저에는 백엔드가 인정하는 토큰이 없다. 그래서 지도·주변 탐색·경로 탐색처럼
 * 실데이터가 필요한 것만 Next 서버가 서비스 토큰을 붙여 대신 호출한다.
 *
 * `BACKEND_ACCESS_TOKEN` 이 없으면 `isBackendEnabled()` 가 false 이고, 라우트는 목으로 답한다.
 * 토큰이 있는데 실패하면 **목으로 조용히 떨어지지 않고 오류를 그대로 올린다** — 유저 테스트 중에
 * 실데이터인 줄 알고 목을 보는 일이 없어야 한다.
 */
import { NextResponse } from "next/server";
import { NO_GENRE_ID } from "@/constants";
import { PC_DIMS, type MapPoint } from "@/types";
import type { Music, PlaylistSummary, User, UserProfile } from "@/types";
import { failLive, LIVE_HEADERS } from "./api-response";

const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "https://j15a405.p.ssafy.io";
const BACKEND_ACCESS_TOKEN = process.env.BACKEND_ACCESS_TOKEN;

/**
 * 배포 백엔드를 부를지.
 *
 * 유저 테스트 동안 백엔드가 인증을 **한시 해제**해서 토큰 없이도 조회가 된다 (BACKEND-NOTES A-17).
 * 그래서 기본값이 "부른다" 다 — 예전처럼 토큰 유무로 판단하면 토큰이 없는 팀원 전부가
 * 목을 실데이터로 착각한 채 테스트하게 된다.
 *
 * 목으로 돌리려면 `USE_MOCK_API=1` 을 켠다 (백엔드가 내려갔거나, 목 화면을 일부러 보고 싶을 때).
 * A-17 이 원복되면 인증이 다시 걸려 401 이 나는데, 그때는 `BACKEND_ACCESS_TOKEN` 을 넣거나
 * 이 값을 켠다 — 조용히 목으로 떨어지지는 않는다.
 */
export function isBackendEnabled(): boolean {
  return process.env.USE_MOCK_API !== "1";
}

export class BackendError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "BackendError";
  }
}

/** 백엔드 공통 응답 봉투 (§0.2) */
interface Envelope<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}

/** 배포 백엔드 호출. 봉투를 벗겨 data 만 돌려준다 */
async function backendFetch<T>(path: string, init?: RequestInit, opts?: { allowNullData?: boolean }): Promise<T> {
  // 토큰은 **있으면 붙인다.** A-17 해제 중에는 없어도 조회가 되고, 원복되면 이게 있어야 한다
  const res = await fetch(`${BACKEND_ORIGIN}${path}`, {
    ...init,
    headers: {
      ...(BACKEND_ACCESS_TOKEN ? { Authorization: `Bearer ${BACKEND_ACCESS_TOKEN}` } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  const text = await res.text();
  let body: Envelope<T> | null = null;
  try {
    body = JSON.parse(text) as Envelope<T>;
  } catch {
    // nginx 가 백엔드로 넘기지 않는 경로는 SPA 의 index.html 이 돌아온다 (BACKEND-NOTES B-16).
    // 그대로 두면 "JSON 아님" 으로만 보여서 원인을 찾기 어렵다.
    throw new BackendError(
      res.status,
      "BACKEND_PATH_NOT_PROXIED",
      `${path} 가 JSON 을 주지 않았습니다. nginx 가 이 경로를 백엔드로 넘기지 않는 것으로 보입니다 (B-16).`,
    );
  }

  if (res.status === 401) {
    // A-17(유저 테스트용 임시 인증 해제)이 원복된 신호다. 원인이 분명해야 토큰을 넣든 목으로 돌리든 한다
    throw new BackendError(
      401,
      "BACKEND_AUTH_REQUIRED",
      `${path} 가 401 입니다. 백엔드 인증이 다시 걸린 것으로 보입니다 (BACKEND-NOTES A-17 원복). BACKEND_ACCESS_TOKEN 을 넣거나 USE_MOCK_API=1 로 목을 쓰세요.`,
    );
  }
  // 지우기처럼 돌려줄 것이 없는 API 는 성공해도 `data` 가 null 이다 (`ApiResponse<Void>`)
  if (!res.ok || !body.success || (body.data == null && !opts?.allowNullData)) {
    throw new BackendError(res.status, body.error?.code ?? "UNKNOWN", body.error?.message ?? "백엔드 호출에 실패했습니다.");
  }

  // allowNullData 일 때만 null 일 수 있다 — 그 경로의 호출자(backendDelete)는 값을 읽지 않는다
  return body.data as T;
}

/** 배포 백엔드 GET 호출. 호출자 자격이 필요하면 `init.headers` 에 {@link callerAuth} 를 얹는다 */
export function backendGet<T>(path: string, init?: RequestInit): Promise<T> {
  return backendFetch<T>(path, init);
}

/**
 * 배포 백엔드 POST 호출.
 *
 * **브라우저가 직접 부르거나 rewrite 로 흘려보내면 안 된다.** 그러면 브라우저의 `Origin` 이
 * 그대로 실려 가고, 백엔드가 허용 목록에 없는 오리진을 `403 Invalid CORS request` 로 막는다.
 * 로컬 `http://localhost:3000` 이 정확히 그 경우다 (S15P21A405-303).
 * 여기서 부르면 Next 서버가 새로 띄우는 요청이라 `Origin` 이 없어 통과한다.
 */
export function backendPost<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  return backendFetch<T>(path, {
    ...init,
    method: "POST",
    headers: { "Content-Type": "application/json", ...init?.headers },
    body: JSON.stringify(body),
  });
}

/**
 * 배포 백엔드 DELETE 호출. 지우는 건 늘 주인만 할 수 있으니 {@link callerAuth} 가 필요하다.
 * 성공 응답에 돌려줄 데이터가 없으므로(`data: null`) 그것을 실패로 보지 않는다.
 */
export function backendDelete(path: string, init?: RequestInit): Promise<unknown> {
  return backendFetch<unknown>(path, { ...init, method: "DELETE" }, { allowNullData: true });
}

/** 배포 백엔드 PATCH 호출. 호출자 자격이 필요하면 `init.headers` 에 {@link callerAuth} 를 얹는다 */
export function backendPatch<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  return backendFetch<T>(path, {
    ...init,
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...init?.headers },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// 인증 통과 (S15P21A405-462) — 로그인한 그 사람 자격으로 백엔드를 부른다
// ---------------------------------------------------------------------------

/**
 * 호출자(브라우저)가 들고 온 액세스 토큰을 그대로 얹는 헤더.
 *
 * **서버 토큰(`BACKEND_ACCESS_TOKEN`)과 용도가 다르다.** 그건 로그인 없는 화면에도 지도를
 * 보여주려고 서비스가 **대신** 부르는 것이고, 이건 **로그인한 그 사람** 자격으로 부르는 것이다.
 * 내 정보·닉네임 변경처럼 "누가 부르는가"가 답을 바꾸는 API 는 반드시 이쪽이어야 한다 —
 * 서버 토큰으로 부르면 모두가 같은 계정의 답을 받는다.
 */
export function callerAuth(req: Request): Record<string, string> {
  const token = req.headers.get("authorization");
  return token ? { Authorization: token } : {};
}

/**
 * access token(JWT) 의 `sub`. 백엔드가 여기에 이메일을 넣는다 (2026-09-18 배포본에서 실측).
 *
 * **서명을 검증하지 않는다.** 여기서는 "누구 것을 물어볼지"만 정하고 진짜 인증은 그 요청을 받은
 * 백엔드가 한다 — 위조한 토큰으로 남의 이메일을 넣어도 백엔드가 그 토큰을 거절한다.
 * 백엔드에 본인 조회(`/me`) API 가 없어서 쓰는 우회다 (BACKEND-NOTES A-15).
 */
export function emailFromToken(req: Request): string | null {
  const payload = req.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: unknown };
    return typeof claims.sub === "string" ? claims.sub : null;
  } catch {
    return null;
  }
}

/**
 * 백엔드가 refresh 쿠키를 심는 경로 (`RefreshTokenCookie`). 우리 인증 경로는 `/bff/auth/*` 라
 * 그대로 두면 **재발급 요청에 쿠키가 실리지 않는다.** 같은 오리진 안에서만 쓰이므로 경로만 넓힌다 —
 * `HttpOnly; Secure; SameSite=Lax` 는 백엔드가 준 그대로 둔다.
 */
const REFRESH_PATH = { from: "Path=/api/auth", to: "Path=/" } as const;

/**
 * 인증 계열 **통과 프록시**. 봉투를 벗기지 않고 상태 코드·본문·`Set-Cookie` 를 그대로 넘긴다.
 *
 * **rewrite 로 흘려보내지 않고 이 프록시를 거치는 이유**는 다른 라우트와 같다 (S15P21A405-303):
 * rewrite 는 브라우저의 `Origin` 을 그대로 전달하고, 백엔드는 허용 목록에 없는 오리진을
 * `403 Invalid CORS request` 로 막는다 — 로컬 `http://localhost:3000` 이 그 경우다.
 * 라우트 핸들러는 Next 서버가 새 요청을 띄우므로 `Origin` 이 안 붙어 로컬·배포가 똑같이 동작한다.
 *
 * 응답을 가공하지 않는 것도 의도다. 로그인 실패 코드(`INVALID_CREDENTIALS` ·
 * `PASSWORD_MISMATCH` …)를 화면이 그대로 분기에 쓰므로 중간에서 갈아치우면 안 된다.
 */
export async function backendProxy(req: Request, upstream: string, method: "POST" | "PATCH" = "POST") {
  const cookie = req.headers.get("cookie");
  const body = await req.text();
  const res = await fetch(`${BACKEND_ORIGIN}${upstream}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...callerAuth(req),
      // 재발급은 refresh 쿠키가 있어야 한다 — 브라우저가 우리에게 보낸 쿠키를 그대로 올린다
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body || undefined,
    cache: "no-store",
  });

  const text = await res.text();
  // nginx 가 백엔드로 넘기지 않는 경로는 SPA 의 index.html 이 돌아온다 (BACKEND-NOTES B-16)
  if (!text.trimStart().startsWith("{")) {
    return failLive("INTERNAL_ERROR", `${upstream} 가 JSON 을 주지 않았습니다. nginx 가 이 경로를 백엔드로 넘기지 않는 것으로 보입니다 (B-16).`, 502, upstream);
  }

  const out = new NextResponse(text, { status: res.status, headers: { "Content-Type": "application/json" } });
  for (const cookie of res.headers.getSetCookie()) out.headers.append("Set-Cookie", cookie.replace(REFRESH_PATH.from, REFRESH_PATH.to));
  out.headers.set(LIVE_HEADERS.source, "live");
  out.headers.set(LIVE_HEADERS.upstream, upstream);
  return out;
}

// ---------------------------------------------------------------------------
// 배포 백엔드가 내려주는 형태 (정본 §0.6). 프론트 도메인 타입과 필드가 달라 여기서만 쓴다.
// ---------------------------------------------------------------------------

/** 16차원 PCA 좌표. 배열이 아니라 pc1~pc16 필드다 */
type BackendLocation = Record<`pc${number}`, number>;

interface BackendMusicSummary {
  id: number;
  title: string;
  artist: string | null;
  album: string | null;
  /** 장르 **이름** 배열. genreId 가 없다 — 지도 색칠에 필요하다 (BACKEND-NOTES B-21) */
  genres: string[] | null;
  /** 검색 URL. 재생 URL 이 아니다 (규칙 6) */
  youtubeUrl: string | null;
  location: BackendLocation | null;
}

export interface BackendMusicDetail extends BackendMusicSummary {
  mbid: string;
  bpm: number | null;
  duration: number | null;
  /** 발매 연도. 없으면 null (S15P21A405-439 로 백엔드가 내려주기 시작했다) */
  releaseYear: number | null;
  playCnt: number | null;
  youtubeCnt: number | null;
}

/** `/api/music/detail` 응답 — 상세 필드가 평탄하게 펼쳐지고 neighbors 가 붙는다 */
export interface BackendMusicDetailResponse extends BackendMusicDetail {
  neighbors: (BackendMusicSummary & { distance: number })[];
}

/**
 * `/api/playlist/detail?playlistId=` 응답 (BACKEND-NOTES 필드 대조).
 * 소유자·시각·좋아요·무드 태그는 없고, 곡은 `musics: MusicDetail[]` 로 평탄하게 온다 — `location` 이 pc1~pc16 이라
 * 별자리 좌표를 여기서 그대로 얻는다 (S15P21A405-214)
 */
export interface BackendPlaylistDetailResponse {
  playlistId: number;
  playlistName: string;
  musicCnt: number;
  totalDuration: number;
  musics: BackendMusicDetail[];
}

/** `/api/music/journey` 응답 — path 원소는 step + MusicDetail 평탄 전개 */
export interface BackendJourneyResponse {
  musicCnt: number;
  totalDuration: number;
  path: (BackendMusicDetail & { step: number })[];
}

/** `{pc1..pc16}` → 지도 엔진이 쓰는 16칸 배열. 좌표가 없으면 0 으로 채운다 */
export function toPcArray(location: BackendLocation | null): number[] {
  return Array.from({ length: PC_DIMS }, (_, i) => location?.[`pc${i + 1}`] ?? 0);
}

/**
 * `/api/music/major` 의 content 원소.
 *
 * **MusicSummary 가 아니다.** 백엔드가 지도 계약에 맞춰 따로 만든 DTO 라 좌표가 `pc1..pc16` 객체가
 * 아니라 **16칸 배열**이고, `genreId`·`weight`·`playable` 이 이미 계산돼 있다 — 곧 프론트
 * {@link MapPoint} 와 필드가 같다. 그래서 {@link toMapPoint} 로 변환하면 안 된다
 * (그 함수는 `{id, location, youtubeUrl}` 을 읽어서, 여기 넣으면 id·좌표가 통째로 사라진다).
 * 2026-09-12 배포된 `/api/v3/api-docs` 의 MapPoint 스키마로 확인했다.
 */
export interface BackendMapPoint {
  musicId: number;
  /** PC 16개. 순서는 pc1..pc16 */
  pc: number[];
  genreId: number;
  weight: number;
  title: string;
  artist: string | null;
  /**
   * 유튜브 검색 URL. 제목·아티스트가 둘 다 비면 null 이고 `playable` 도 false 다.
   * **배포가 이 필드를 아직 안 내려주는 동안에는 undefined 로 온다** (2026-09-12 기준) —
   * 그래서 아래에서 null 로 받아 둔다.
   */
  youtubeUrl?: string | null;
  playable: boolean;
}

/**
 * 상주 집합 원소 → 지도 위의 점. 필드가 같으므로 **그대로 통과시킨다.**
 * 좌표 길이만 16으로 맞춘다 — 엔진이 겹마다 `pc[2l]`·`pc[2l+1]` 을 짚어서, 짧으면 undefined 가
 * 흘러들어 화면 좌표가 NaN 이 되고 별이 통째로 사라진다.
 */
export function toResidentPoint(p: BackendMapPoint): MapPoint {
  return {
    musicId: p.musicId,
    pc: Array.from({ length: PC_DIMS }, (_, i) => p.pc?.[i] ?? 0),
    genreId: p.genreId,
    weight: p.weight,
    title: p.title,
    artist: p.artist ?? null,
    youtubeUrl: p.youtubeUrl ?? null,
    playable: p.playable,
  };
}

/**
 * 백엔드 곡 → 지도 위의 점.
 *
 * `genreId` 와 `weight` 는 백엔드 응답에 없다 (B-21). 각각 별 색과 크기를 정하는 값이라
 * 없으면 지도가 단색·균일 크기로 보인다. 고정값을 넣어 두되 **없는 것을 지어내지는 않는다.**
 *
 * 장르는 `genres` 이름 배열만 오고 id 가 없으므로 **모르는 장르(무장르)** 로 둔다 —
 * 0(앰비언트)으로 채우면 "장르를 모른다"가 "전부 앰비언트다"로 둔갑한다 (A-1-1).
 * 실데이터는 662만 곡 중 1.0%만 장르가 붙어 있어 그 오해가 화면 거의 전부를 덮는다.
 */
/**
 * 백엔드 MusicDetail → ERD `Music`. 백엔드에 없는 값은 **지어내지 않고 비운다**.
 * `releaseYear` 는 S15P21A405-439 로 응답에 추가됐다 — 백엔드 배포 전에는 undefined 라 null 로 떨어진다.
 * 곡 상세·플리 상세가 같은 변환을 쓴다
 */
export function toMusic(res: BackendMusicDetail): Music {
  return {
    id: res.id,
    mbid: res.mbid,
    title: res.title,
    artist: res.artist,
    releaseYear: res.releaseYear ?? null,
    bpm: res.bpm,
    duration: res.duration,
    album: res.album,
    youtubeUrl: res.youtubeUrl,
    // videoId 는 매핑하지 않는다 — 전용 엔드포인트가 출처다 (S15P21A405-340)
    location: res.location ? (toPcArray(res.location) as Music["location"]) : null,
    playCnt: res.playCnt ?? 0,
    youtubeCnt: res.youtubeCnt ?? 0,
  };
}

export function toMapPoint(music: BackendMusicSummary): MapPoint {
  return {
    musicId: music.id,
    pc: toPcArray(music.location),
    genreId: NO_GENRE_ID,
    weight: 1,
    title: music.title,
    artist: music.artist,
    // 검색·상세·주변곡은 이미 검색 URL 을 담아 준다 (S15P21A405-233). 조립하지 않고 그대로 쓴다
    youtubeUrl: music.youtubeUrl ?? null,
    playable: music.youtubeUrl != null,
  };
}

// ---------------------------------------------------------------------------
// 사용자 (S15P21A405-462)
// ---------------------------------------------------------------------------

/**
 * `GET /api/user/detail?email=` 응답 (2026-09-18 배포 스펙 `UserDetailResponse`).
 *
 * 우리 {@link User} 와 다른 점: `followerCnt`·`followingCnt`·`isFollowing`·`isMe` 가 더 오고,
 * `updatedAt` 은 오지 않는다.
 */
export interface BackendUserDetail {
  email: string;
  name: string | null;
  nickname: string | null;
  isPublic: boolean;
  tutorialCompleted: boolean;
  lastActiveAt: string | null;
  createdAt: string;
  imageUrl: string | null;
  followerCnt: number;
  followingCnt: number;
  isFollowing: boolean;
  isMe: boolean;
}

export function toUser(u: BackendUserDetail): User {
  return {
    email: u.email,
    name: u.name,
    nickname: u.nickname,
    isPublic: u.isPublic,
    tutorialCompleted: u.tutorialCompleted,
    lastActiveAt: u.lastActiveAt,
    createdAt: u.createdAt,
    // 백엔드 응답에 없다. lastActiveAt 으로 대신 채우면 "마지막 접속"이 "마지막 수정"으로 둔갑한다
    updatedAt: null,
    imageUrl: u.imageUrl,
  };
}

/**
 * 마지막 활동이 이 안쪽이면 접속 중으로 본다.
 *
 * ponytail: 백엔드에 온라인 플래그가 없어서 `lastActiveAt` 으로 **가늠한** 값이다 (BACKEND-NOTES A-35).
 * 실시간 소켓 접속자 목록이 생기면 그걸로 바꾼다 — 이 창은 그때까지의 근사치다.
 */
const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 백엔드 사용자 상세 → 마이페이지·프로필이 쓰는 {@link UserProfile}.
 *
 * **백엔드에 없는 것은 지어내지 않는다** (BACKEND-NOTES A-35). 지금 듣는 곡·만남 횟수·따라가는
 * 대상·대시보드 통계는 배포 API 에 아예 없어서 빈 값으로 둔다 — 목으로 채우면 실데이터인 줄 알고
 * 보게 되고, 그게 이 프로젝트에서 제일 비싼 종류의 착각이다.
 */
export function toUserProfile(u: BackendUserDetail): UserProfile {
  const joined = Date.parse(u.createdAt);
  const active = u.lastActiveAt ? Date.parse(u.lastActiveAt) : NaN;
  return {
    ...toUser(u),
    isOnline: Number.isFinite(active) && Date.now() - active < ONLINE_WINDOW_MS,
    followerCount: u.followerCnt,
    followingCount: u.followingCnt,
    // "N일째 탐험중" — 가입 당일이 1일째다
    daysSinceJoined: Number.isFinite(joined) ? Math.max(1, Math.floor((Date.now() - joined) / DAY_MS) + 1) : 1,
    isFollowing: u.isFollowing,
    nowPlaying: null,
    meetingCount: null,
    followingTarget: null,
    dashboard: { exploredCount: 0, discoveredCount: 0, moodPreference: [] },
  };
}

// ---------------------------------------------------------------------------
// 플레이리스트 (S15P21A405-468)
// ---------------------------------------------------------------------------

/** `GET /api/playlist/search?email=` 의 원소. **좋아요·무드 태그·소유자 닉네임이 없다** (A-36) */
export interface BackendPlaylistSummary {
  playlistId: number;
  playlistName: string;
  musicCnt: number;
  createdAt: string;
}

/**
 * 백엔드 플리 요약 → 화면이 쓰는 {@link PlaylistSummary}.
 * 좋아요 수와 소유자 닉네임은 응답에 없어서 null 이다 — 0 으로 채우면 "좋아요가 0개" 라는
 * 없는 사실이 된다. 화면은 null 을 "모름" 으로 다룬다.
 */
export function toPlaylistSummary(p: BackendPlaylistSummary): PlaylistSummary {
  return { id: p.playlistId, playlistName: p.playlistName, likeCnt: null, itemCount: p.musicCnt, ownerNickname: null };
}
