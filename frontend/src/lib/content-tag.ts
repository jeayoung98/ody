import { createHash } from "node:crypto";

/**
 * **서버 전용.** 곡 목록이 바뀌었는지 가르는 태그 (S15P21A405-680). 응답의 `ETag` 로 쓴다.
 *
 * 브라우저는 받은 목록을 HTTP 캐시에 두고, 다음 요청에 이 태그를 실어 "바뀌었나" 를 묻는다(`If-None-Match`).
 * 태그가 같으면 서버는 본문 없이 304 만 돌려주고 브라우저는 들고 있던 목록을 쓴다 — 1,576KB 를 다시 받지 않는다.
 * 다르면 새 목록을 받는다. 그래서 **항상 최신 목록이 보인다.**
 *
 * **순서는 태그에 넣지 않는다.** 백엔드 1겹 조회에 정렬이 없어 같은 목록이 다른 순서로 올 수 있다 — 순서까지 넣으면
 * 내용이 같아도 태그가 달라져 매번 다시 받는다. `musicId` 순으로 줄 세운 뒤 곡마다 해시에 넣는다.
 */
export function contentTag(items: readonly { musicId: number }[]): string {
  const sorted = [...items].sort((a, b) => a.musicId - b.musicId);
  const hash = createHash("sha1");
  for (const item of sorted) hash.update(JSON.stringify(item));
  return hash.digest("base64url").slice(0, 22);
}

/**
 * 요청의 `If-None-Match` 가 이 태그를 가리키는가. 약한 비교다 — `W/` 와 따옴표를 떼고 본다
 * (본문이 gzip 이든 아니든 같은 목록이면 같은 태그라 약한 태그를 쓴다). `*` 는 무엇이든 맞다.
 */
export function matchesTag(ifNoneMatch: string | null | undefined, tag: string): boolean {
  if (!ifNoneMatch) return false;
  return ifNoneMatch.split(",").some((raw) => {
    const t = raw.trim();
    return t === "*" || t.replace(/^W\//, "").replace(/^"|"$/g, "") === tag;
  });
}
