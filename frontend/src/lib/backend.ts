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
import { NO_GENRE_ID } from "@/constants";
import { PC_DIMS, type MapPoint } from "@/types";

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

/** 배포 백엔드 GET 호출. 봉투를 벗겨 data 만 돌려준다 */
export async function backendGet<T>(path: string): Promise<T> {
  // 토큰은 **있으면 붙인다.** A-17 해제 중에는 없어도 조회가 되고, 원복되면 이게 있어야 한다
  const res = await fetch(`${BACKEND_ORIGIN}${path}`, {
    headers: BACKEND_ACCESS_TOKEN ? { Authorization: `Bearer ${BACKEND_ACCESS_TOKEN}` } : {},
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
  if (!res.ok || !body.success || body.data == null) {
    throw new BackendError(res.status, body.error?.code ?? "UNKNOWN", body.error?.message ?? "백엔드 호출에 실패했습니다.");
  }

  return body.data;
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
  youtubeUrl: string | null;
  location: BackendLocation | null;
}

export interface BackendMusicDetail extends BackendMusicSummary {
  mbid: string;
  bpm: number | null;
  duration: number | null;
  playCnt: number | null;
  youtubeCnt: number | null;
}

/** `/api/music/detail` 응답 — 상세 필드가 평탄하게 펼쳐지고 neighbors 가 붙는다 */
export interface BackendMusicDetailResponse extends BackendMusicDetail {
  neighbors: (BackendMusicSummary & { distance: number })[];
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
