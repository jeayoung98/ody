/** 검색 (SEARCH-01) */

/**
 * 한 번에 받아오는 결과 수. **백엔드 페이지 크기와 같아야 한다** — 배포 백엔드
 * `GET /api/music/search` 가 `size: 10` 으로 고정이고, 프론트는 page 번호만 넘긴다.
 * 목 라우트도 같은 크기로 잘라서 화면이 실데이터와 목을 가려 쓰지 않게 한다.
 */
export const SEARCH_PAGE_SIZE = 10;

/**
 * 목록 바닥에서 이만큼 남았을 때 다음 페이지를 부른다(px).
 * 검색 한 페이지가 18~24초 걸려서(BACKEND-NOTES B-23) **바닥에 닿고 나서 부르면 이미 늦다** —
 * 조금 일찍 걸어 둔다. 그래도 기다림이 길어 목록 밑에 상태를 띄운다.
 */
export const SEARCH_LOAD_MORE_MARGIN_PX = 160;
