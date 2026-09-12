/**
 * **서버 전용.** `src/app/api/` 라우트 핸들러에서만 쓴다 — 브라우저 번들에 들어가면 토큰이 샌다.
 *
 * 로그인이 목이라 브라우저에는 백엔드가 인정하는 토큰이 없다. 그래서 지도·주변 탐색·경로 탐색처럼
 * 실데이터가 필요한 것만 Next 서버가 서비스 토큰을 붙여 대신 호출한다.
 *
 * `BACKEND_ACCESS_TOKEN` 이 없으면 `isBackendEnabled()` 가 false 이고, 라우트는 목으로 답한다.
 * 토큰이 있는데 실패하면 **목으로 조용히 떨어지지 않고 오류를 그대로 올린다** — 유저 테스트 중에
 * 실데이터인 줄 알고 목을 보는 일이 없어야 한다.
 */
import { PC_DIMS, type MapPoint } from "@/types";

const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "https://j15a405.p.ssafy.io";
const BACKEND_ACCESS_TOKEN = process.env.BACKEND_ACCESS_TOKEN;

export function isBackendEnabled(): boolean {
  return Boolean(BACKEND_ACCESS_TOKEN);
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
  if (!BACKEND_ACCESS_TOKEN) {
    throw new BackendError(500, "BACKEND_TOKEN_MISSING", "BACKEND_ACCESS_TOKEN 이 설정되지 않았습니다.");
  }

  const res = await fetch(`${BACKEND_ORIGIN}${path}`, {
    headers: { Authorization: `Bearer ${BACKEND_ACCESS_TOKEN}` },
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
 * 백엔드 곡 → 지도 위의 점.
 *
 * `genreId` 와 `weight` 는 백엔드 응답에 없다 (B-21). 각각 별 색과 크기를 정하는 값이라
 * 없으면 지도가 단색·균일 크기로 보인다. 고정값을 넣어 두되 **없는 것을 지어내지는 않는다.**
 */
export function toMapPoint(music: BackendMusicSummary): MapPoint {
  return {
    musicId: music.id,
    pc: toPcArray(music.location),
    genreId: 0,
    weight: 1,
    title: music.title,
    artist: music.artist,
    playable: music.youtubeUrl != null,
  };
}
