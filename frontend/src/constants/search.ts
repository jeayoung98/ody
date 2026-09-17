/** 검색 (SEARCH-01) */

/**
 * 한 번에 받아오는 결과 수. **백엔드 페이지 크기와 같아야 한다** — 배포 백엔드
 * `GET /api/music/search` 가 `size: 10` 으로 고정이고, 프론트는 page 번호만 넘긴다.
 * 목 라우트도 같은 크기로 잘라서 화면이 실데이터와 목을 가려 쓰지 않게 한다.
 */
export const SEARCH_PAGE_SIZE = 10;

/**
 * 백엔드가 제목 단독 조건을 지원할 때까지 BFF 가 통합 검색을 훑는 최대 페이지 수.
 * 흔한 검색어에서도 한 화면을 채우되, 드문 제목 하나 때문에 백엔드를 끝없이 호출하지 않는다.
 */
export const TITLE_SEARCH_MAX_UPSTREAM_PAGES = 5;

/**
 * 목록 바닥에서 이만큼 남았을 때 다음 페이지를 부른다(px).
 * 검색 한 페이지가 18~24초 걸려서(BACKEND-NOTES B-23) **바닥에 닿고 나서 부르면 이미 늦다** —
 * 조금 일찍 걸어 둔다. 그래도 기다림이 길어 목록 밑에 상태를 띄운다.
 */
export const SEARCH_LOAD_MORE_MARGIN_PX = 160;

/**
 * 입력이 멎기를 기다리는 시간(ms). 한 글자마다 묻지 않는다 (S15P21A405-399).
 * 닉네임 중복 검사(`nickname-check-field`)와 같은 값으로 맞춘다 — 같은 종류의 기다림이다.
 */
export const SEARCH_DEBOUNCE_MS = 350;
