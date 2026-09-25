import { gzip } from "node:zlib";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { MAP_SONGS_GZIP_LEVEL } from "@/constants";
import { acceptsGzip } from "./accept-encoding";
import { LIVE_HEADERS } from "./api-response";

const gzipAsync = promisify(gzip);

/**
 * **서버 전용.** `okLive` 와 같은 봉투·실데이터 표시를 달고, 요청이 gzip 을 받으면 압축해서 보낸다 (S15P21A405-680).
 *
 * Next 는 페이지와 정적 파일만 gzip 하고 **라우트 핸들러 응답은 그대로 보낸다.** 그래서 지도 1겹 응답 1,576KB 가
 * 원본 그대로 브라우저까지 갔다(배포본 실측 — 전송량이 원본과 같았다). nginx 도 JSON 을 압축하지 않는다.
 * 여기서 압축하면 3분의 1 안팎이 된다. 이미 `Content-Encoding` 이 붙은 응답은 Next 가 다시 압축하지 않는다.
 *
 * `api-response.ts` 에 두지 않은 이유: 그 파일은 브라우저 쪽 `live-log.ts` 도 불러서, 거기에 `node:zlib` 를 넣으면
 * 클라이언트 번들이 깨진다. 압축은 스레드풀에서 돌아(`zlib.gzip`) 이벤트 루프를 막지 않는다.
 */
export async function okLiveGzip<T>(req: Request, data: T, upstream: string): Promise<NextResponse> {
  const json = JSON.stringify({ success: true, data, error: null });
  const headers: Record<string, string> = {
    "content-type": "application/json",
    vary: "Accept-Encoding",
    [LIVE_HEADERS.source]: "live",
    [LIVE_HEADERS.upstream]: upstream,
  };
  if (!acceptsGzip(req.headers.get("accept-encoding"))) return new NextResponse(json, { status: 200, headers });
  const body = await gzipAsync(json, { level: MAP_SONGS_GZIP_LEVEL });
  return new NextResponse(new Uint8Array(body), { status: 200, headers: { ...headers, "content-encoding": "gzip" } });
}
