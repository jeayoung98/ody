/**
 * `Accept-Encoding` 이 gzip 을 받는가 (S15P21A405-680).
 *
 * `gzip;q=0` 은 "gzip 은 싫다" 는 뜻이라 거절로 본다. `*` 는 아무 인코딩이나 받는다는 뜻이라 gzip 도 되지만,
 * gzip 을 이름으로 따로 적었으면 그쪽이 이긴다. 브라우저는 늘 `gzip, deflate, br, zstd` 처럼 이름으로 보낸다.
 *
 * 서버 전용 파일(`gzip-json.ts`)에서 떼어 둔 이유는 테스트다 — 그쪽은 `node:zlib`·`next/server` 를 불러서
 * 판정만 따로 재기 어렵다.
 */
export function acceptsGzip(header: string | null | undefined): boolean {
  if (!header) return false;
  let star = false;
  for (const part of header.split(",")) {
    const [name, ...params] = part.trim().toLowerCase().split(";");
    const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    const weight = q === undefined ? 1 : Number(q.slice(2));
    if (name === "gzip") return weight > 0;
    if (name === "*") star = weight > 0;
  }
  return star;
}
