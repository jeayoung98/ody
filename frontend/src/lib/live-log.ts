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
