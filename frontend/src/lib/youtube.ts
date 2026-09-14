/**
 * 곡의 유튜브 재생 (SONG-03).
 *
 * **규칙 6 (data/AGENTS.md, D15 2026-09-13 개정) 이 기준이다.**
 * 음원 파일 재생·다운로드·스크래핑은 금지고, 재생은 **공식 플레이어 임베드(YouTube IFrame
 * Player)로만** 한다. 임베드는 FE 담당이다 (`data/specs/15_playability/spec.md`).
 *
 * 그래서 길이 두 갈래다.
 *
 * | 곡이 가진 것 | 어떻게 듣나 |
 * | --- | --- |
 * | `videoId` 있음 | 사이트 안에서 공식 플레이어로 재생 (`youtube-embed.tsx`) |
 * | `videoId` 없음 | 백엔드가 준 **검색 URL** 을 새 탭으로 (규칙 6 상 검색 URL 만 허용) |
 *
 * `youtubeUrl` 은 재생 URL 이 아니라 검색 URL 이다
 * (`https://www.youtube.com/results?search_query=...`). 링크를 조립하지 않고 백엔드가 준
 * 문자열을 그대로 연다.
 *
 * **2026-09-14 기준 실데이터는 전 곡 `videoId` 가 null 이다** — 수집 스크립트가 아직 안 돌았다
 * (`data/specs/18_db_ingest/spec.md`). 그래서 지금은 사실상 전부 아래 검색 URL 경로로 떨어진다.
 */
export function openYoutube(url: string | null | undefined): boolean {
  if (!url) return false;
  // noopener 를 빼면 열린 탭이 window.opener 로 이 페이지를 조작할 수 있다
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}
