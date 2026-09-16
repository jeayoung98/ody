import { LIVE_HEADERS } from "./api-response";

/**
 * **배포 백엔드에서 온 응답만** 브라우저 콘솔에 찍는다 (개발 빌드 한정).
 *
 * 라우트 핸들러가 백엔드를 서버에서 대신 부르기 때문에, 브라우저는 결과물만 보고 출처를 모른다.
 * 그래서 실호출한 응답에만 `x-ody-source: live` 가 붙어 오고, 여기서 그것만 골라 찍는다.
 *
 * **목 응답은 일부러 찍지 않는다.** 섞여 나오면 목을 실데이터로 오해하게 되어, 이 로그를 두는
 * 목적과 정반대가 된다.
 */
export function logLiveResponse(path: string, res: Response, body: unknown, ms: number) {
  if (process.env.NODE_ENV === "production") return;
  if (res.headers.get(LIVE_HEADERS.source) !== "live") return;

  const upstream = res.headers.get(LIVE_HEADERS.upstream) ?? "-";
  const envelope = body as { success?: boolean; data?: unknown; error?: { code?: string; message?: string } } | null;
  const okFlag = res.ok && envelope?.success === true;
  const badge = okFlag ? "✅ 연결됨" : "❌ 실패";
  const tone = okFlag ? "color:#4fe3ce" : "color:#ff7a90";

  console.groupCollapsed(`%c[ODY ${badge}]%c ${path} %c${res.status} · ${Math.round(ms)}ms`, `${tone};font-weight:600`, "color:inherit", "color:#93a4c4");
  console.log("백엔드 경로", upstream);
  if (okFlag) {
    const data = envelope?.data;
    if (Array.isArray(data)) console.log(`데이터 (${data.length}건)`, data);
    else console.log("데이터", data);
  } else {
    console.log("오류 코드", envelope?.error?.code ?? `HTTP ${res.status}`);
    console.log("메시지", envelope?.error?.message ?? "(없음)");
  }
  console.groupEnd();
}

/** {@link logVideoId} 가 받는 해석 결과. `useVideoIdQuery` 에서 그대로 꺼내 넘긴다 */
interface VideoIdResolution {
  status: "pending" | "error" | "success";
  /**
   * 검색이 어디까지 갔는가 (S15P21A405-332 · 364).
   *
   * **`videoId` 유무로 가르지 않는다.** 그러면 "찾아봤는데 없다" 와 "아직 안 찾아봤다" 가
   * 같은 줄로 찍혀서, 기다려도 안 될 곡과 다시 부르면 될 곡을 로그에서 구분할 수 없다.
   */
  lookup: "found" | "notFound" | "unsearched";
  videoId: string | null;
  /** 실패했을 때의 `ApiError`. 타입을 좁게 잡지 않는다 — `lib/api.ts` 가 이 파일을 부르므로 거꾸로 import 하면 순환이다 */
  error: { code?: string; message?: string } | null;
  /** 이번에 새로 조회한 게 아니라 캐시에 있던 값인가 */
  fromCache: boolean;
  /** 재생 맥락. `여정 3/7` 처럼 어느 정차인지까지 담는다 */
  where: string;
}

/**
 * **지금 곡이 소리가 날지 안 날지**를 콘솔에 한 줄로 말한다 (S15P21A405-363).
 *
 * 위 {@link logLiveResponse} 만으로는 여정에서 곡이 조용히 지나갈 때 이유를 짚을 수 없었다 —
 *
 * - 음원이 없어도 백엔드는 **정상 응답**이라 `✅ 연결됨` 으로 찍히고, 접힌 그룹 안에 들어가
 *   **재생 불가라는 사실이 펼쳐보기 전까지 안 보인다.**
 * - `useVideoIdQuery` 의 `staleTime` 이 30분이라 **캐시에 있는 곡은 요청이 아예 안 나가고**,
 *   그러면 콘솔에도 아무것도 남지 않는다. 여정은 같은 곡을 다시 만나는 일이 잦다.
 * - 조회가 끝나기 전에는 임베드가 아무것도 하지 않는데, 그 대기 상태도 보이지 않는다.
 *
 * 그래서 **응답이 아니라 곡을 기준으로** 찍는다. 곡이 바뀔 때마다 한 줄이므로,
 * 소리가 빠진 정차를 로그에서 그대로 짚을 수 있다.
 *
 * 말은 화면과 맞춘다 — `notFound` 는 화면에서도 "아직 준비 중인 곡" 이다 (`PLAYBACK_BLOCKED`).
 */
export function logVideoId(musicId: number, r: VideoIdResolution) {
  if (process.env.NODE_ENV === "production") return;

  const [badge, tone, why] =
    r.status === "pending"
      ? ["⏳ 조회 중", "color:#93a4c4", "아직 응답 전이라 임베드가 대기한다"]
      : r.status === "error"
        ? ["❌ 조회 실패", "color:#ff7a90", r.error?.message ?? "(메시지 없음)"]
        : r.lookup === "found"
          ? ["🔊 재생 가능", "color:#4fe3ce", "임베드가 이 영상을 건다"]
          : r.lookup === "notFound"
            ? ["🔇 준비 중", "color:#ffd166", '백엔드가 유튜브를 찾아봤는데 없었다 ("none"). 다시 눌러도 같은 답이라 여정에서는 건너뛴다 (SONG-04)']
            : ["❓ 아직 안 찾아봄", "color:#93a4c4", "백엔드가 아직 검색하지 않았다 (null). 다시 부르면 채워질 수 있다"];

  const source = r.status === "success" && r.fromCache ? "캐시" : "조회";

  console.groupCollapsed(`%c[ODY videoId ${badge}]%c musicId ${musicId} · ${r.where} %c(${source})`, `${tone};font-weight:600`, "color:inherit", "color:#93a4c4");
  console.log("이유", why);
  console.log("videoId", r.videoId ?? "(없음)");
  if (r.status === "error") console.log("오류 코드", r.error?.code ?? "UNKNOWN");
  console.log("백엔드 경로", "/api/music/videoid");
  console.groupEnd();
}
