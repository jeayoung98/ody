/**
 * 곡의 유튜브 링크를 연다 (SONG-03).
 *
 * 백엔드가 주는 `youtubeUrl` 은 **재생 URL 이 아니라 검색 URL** 이다
 * (`https://www.youtube.com/results?search_query=...`). 규칙 6 이 음원 재생·다운로드·임베드를
 * 금지하고 검색 URL 만 허용하기 때문이다 — 백엔드도 watch·임베드 URL 은 만들지 않는다.
 *
 * 그래서 앱 안에서 소리를 내지 않고 **새 탭으로 넘긴다.** 링크 조립도 하지 않는다:
 * 백엔드가 준 문자열을 그대로 연다.
 */
export function openYoutube(url: string | null | undefined): boolean {
  if (!url) return false;
  // noopener 를 빼면 열린 탭이 window.opener 로 이 페이지를 조작할 수 있다
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}
