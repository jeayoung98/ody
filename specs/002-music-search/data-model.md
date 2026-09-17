# Data Model: 음악·아티스트 조건 검색

## 검색 조건 (신규 영속 엔티티 아님)

MusicSearchCondition(query, music, artist): nullable String 3개를 가진 record.
누락은 null, 전달된 빈 문자열/공백은 INVALID_INPUT이다. 유효한 문자열은 앞뒤 공백을 제거한다.

| 조합 | 허용 |
| --- | --- |
| query만 | 통합 검색 |
| artist만 | 아티스트 검색 |
| music+artist | 두 조건 AND |
| 전부 없음, music만, query와 필터 혼합 | 400 INVALID_INPUT |

page는 별도 필수 int ≥ 0. 크기 10, offset 계산은 long. 소문자 변환은 Locale.ROOT, LIKE의 역슬래시·%·_ 이스케이프는 기존 adapter에서 수행한다.

## 기존 데이터

music의 id(PK), title, nullable artist, album, video_id, location을 재사용한다. 아티스트 이름은 식별자가 아니므로 동명이인/공동 표기/별칭을 분리하지 않는다. NULL 아티스트는 필터와 일치하지 않는다. video_id='none'은 모든 경로에서 제외하고 NULL은 포함한다.

music_genre/genre 관계와 장르 일괄 조회를 유지한다. 테이블, 컬럼, 제약, 인덱스 추가 및 백필은 계획하지 않는다.

## 응답

기존 MusicSummary: id, title, artist, album, genres(List<String>), youtubeUrl, videoId, location(pc1..pc16).
PageResponse: content, page, size=10, hasNext. 총 개수 없음.
좌표·재생 정보 조립은 기존 구현 재사용.

## UI 상태

all(input) → artist(고정 이름, 음악 입력) 또는 music(고정 제목, 아티스트 입력).
artist의 빈 입력은 아티스트 단독 요청, music의 빈 입력은 요청 없는 입력 대기.
칩 제거는 남은 input으로 all 복귀. 남은 값이 없으면 요청하지 않는다.
조건 변경은 page=0 및 이전 결과 누적 초기화. 결과 선택은 기존 지도 동작과 전체 검색 초기화.
