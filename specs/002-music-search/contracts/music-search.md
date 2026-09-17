# Contract: 음악·아티스트 조건 검색

**상태**: 2026-09-17 구현 목표 계약. 현재 배포 완료를 의미하지 않는다.
기존 query 요청은 호환 유지한다. frontend-handoff.md는 이 계약을 참조한다.

## GET /api/music/search

| 파라미터 | 규칙 |
| --- | --- |
| query | 선택 문자열. 통합 검색, 다른 조건과 혼합 금지 |
| artist | 선택 문자열. 아티스트 단독 또는 music과 함께 |
| music | 선택 문자열. artist와 함께만 허용 |
| page | 필수 정수, 0 이상. 0-based |

전달한 문자열이 빈 값/공백이면 400. 모든 조건 누락, music 단독, query+artist, query+music도 400.
유효한 문자열은 trim하고 대소문자 무시 앞일치로 비교한다. %, _, 역슬래시는 리터럴이다.
프론트는 비어 있는 선택 입력을 파라미터로 보내지 않는다.

예:
- /api/music/search?query=Love&page=0
- /api/music/search?artist=Radiohead&page=0
- /api/music/search?music=Love&artist=Lana%20Del%20Rey&page=0

## 매칭·정렬

통합: 제목 완전일치 → 아티스트 완전일치 → 제목 앞일치 → 아티스트 앞일치.
아티스트: 아티스트 완전일치 → 완전일치를 제외한 앞일치.
동시 조건: 모두 완전일치 → 아티스트만 완전일치 → 음악만 완전일치 → 모두 앞일치(완전일치 제외).
모든 단계 내부는 id ASC. 한 음악은 가장 높은 단계에 한 번만 포함한다.
video_id='none' 제외, NULL 유지. NULL 아티스트는 아티스트 조건에 불일치한다.
고정 데이터에서 같은 요청은 같은 순서이며 페이지 간 누락/중복이 없어야 한다. 요청 사이 데이터 갱신에 대한 스냅샷 보장은 추가하지 않는다.

## 응답·오류

기존 공통 봉투 success/data/error 유지.
성공 data는 {content: MusicSummary[], page: number, size: 10, hasNext: boolean}.
MusicSummary의 id/title/artist/album/genres/youtubeUrl/videoId/location은 기존 타입 그대로다.
hasNext는 11번째 항목 존재로 판정한다. 빈 결과와 범위를 넘는 페이지는 200, content=[], hasNext=false.
totalElements/totalPages는 없다.

| 실패 | HTTP / code |
| --- | --- |
| 잘못된 조합, 빈 값, page 누락·음수·비정수 | 400 INVALID_INPUT |
| 인증 실패 | 401, 기존 인증 계층 계약 |
| 내부 오류·SQL timeout | 500 INTERNAL_SERVER_ERROR |

실패 봉투는 success=false, data=null, error={code,message}.
인증은 Bearer 계약을 유지하지만 현재 임시 permitAll로 미인증 401이 보장되지 않는다. Core 복구 후 인수 검증이 필요하다.

## 내부 호출

MusicService.search(MusicSearchCondition condition, int page)
→ MusicSearchReader.search(condition, page, size)
→ adapter가 query 경로에서 기존 findPage, 필터 경로에서 findFilteredPage 호출.

findFilteredPage는 정규화된 artist 원문/앞일치 패턴, 선택 music 원문/패턴, cap/size/offset을 받는다.
SQL 값은 MyBatis 바인딩만 사용하고 사용자 값을 SQL 문자열로 연결하지 않는다.
응답 조립과 findGenresByMusicIds는 공유한다.

## UI 연결

아티스트 칩+빈 입력: artist 단독 요청.
음악 칩+빈 입력: 요청하지 않고 아티스트 입력 안내.
두 번째 입력 존재: music+artist 요청.
칩 제거: 남은 입력으로 query 요청, 없으면 요청 중지.
신규 파라미터를 지원하는 BE 배포 후 FE 활성화. 기존 query 호출자는 그대로 동작한다.
