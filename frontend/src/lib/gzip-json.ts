import { gzip } from "node:zlib";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { MAP_SONGS_GZIP_LEVEL } from "@/constants";
import { acceptsGzip } from "./accept-encoding";
import { LIVE_HEADERS } from "./api-response";
import { matchesTag } from "./content-tag";

const gzipAsync = promisify(gzip);

/**
 * **서버 전용.** `okLive` 와 같은 봉투·실데이터 표시를 달고, 요청이 gzip 을 받으면 압축해서 보낸다 (S15P21A405-680).
 *
 * Next 는 페이지와 정적 파일만 gzip 하고 **라우트 핸들러 응답은 그대로 보낸다.** 그래서 지도 1겹 응답 1,576KB 가
 * 원본 그대로 브라우저까지 갔다(배포본 실측 — 전송량이 원본과 같았다). nginx 도 JSON 을 압축하지 않는다.
 * 여기서 압축하면 3분의 1 안팎이 된다. 이미 `Content-Encoding` 이 붙은 응답은 Next 가 다시 압축하지 않는다.
 *
 * `tag` 를 주면 **바뀌었을 때만 본문을 보낸다.** 응답에 `ETag` 와 `Cache-Control: private, no-cache` 를 달아 브라우저가
 * 받은 목록을 HTTP 캐시에 두고 매번 "바뀌었나" 를 묻게 한다. 요청의 `If-None-Match` 가 같은 태그면 본문 없이 304 —
 * 브라우저는 들고 있던 목록을 쓴다. `no-cache` 라 묻지 않고 옛 목록을 쓰는 일은 없다. 태그는 `content-tag.ts` 참고.
 *
 * `api-response.ts` 에 두지 않은 이유: 그 파일은 브라우저 쪽 `live-log.ts` 도 불러서, 거기에 `node:zlib` 를 넣으면
 * 클라이언트 번들이 깨진다. 압축은 스레드풀에서 돌아(`zlib.gzip`) 이벤트 루프를 막지 않는다.
 */
export async function okLiveGzip<T>(req: Request, data: T, upstream: string, tag?: string): Promise<NextResponse> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    vary: "Accept-Encoding",
    [LIVE_HEADERS.source]: "live",
    [LIVE_HEADERS.upstream]: upstream,
  };
  if (tag) {
    headers.etag = `W/"${tag}"`;
    headers["cache-control"] = "private, no-cache";
    if (matchesTag(req.headers.get("if-none-match"), tag)) return new NextResponse(null, { status: 304, headers });
  }
  const json = JSON.stringify({ success: true, data, error: null });
  if (!acceptsGzip(req.headers.get("accept-encoding"))) return new NextResponse(json, { status: 200, headers });
  const body = await gzipAsync(json, { level: MAP_SONGS_GZIP_LEVEL });
  return new NextResponse(new Uint8Array(body), { status: 200, headers: { ...headers, "content-encoding": "gzip" } });
}
