# Quickstart: 음악 검색 검증

구현 후 실행할 검증 절차. 지금은 컨트롤러 슬라이스(검증·에러)와 port mock까지 작성 가능,
실데이터 통합은 B-D(BE4 저장소) 후.

## 전제

- Java 17, `./gradlew test` (webmvc-test + MockitoBean).
- 실데이터 통합: B-A(인증)·B-D(저장소) 확정 후.

## 검증 시나리오 (spec 수용 기준 대응)

| # | 요청 | 기대 | 대응 |
| --- | --- | --- | --- |
| A1 | `GET /music/search?query=IU&page=0` (매칭 있음) | 200, content 배열 + page/size/totalElements/totalPages/hasNext | FR-001·004 |
| A2 | 위 성공 응답 | 각 항목 MusicSummary 필드 + location pc1~pc16 baseline 일치 | FR-005·006 |
| A3 | youtubeUrl null 곡 포함 매칭 | 해당 곡 제외 안 됨, `youtubeUrl:null` 유지 | FR-007 |
| A4 | 매칭 11건 이상, page=1 | 10건 단위 페이지, hasNext 반영 | FR-004 |
| A5 | 정렬 검증(youtubeCnt 300·100·200, id로 tie) | youtubeCnt DESC, 동률 id ASC 순서 | FR-010 |
| A6 | 매칭 substring "wins"가 title/artist 어디든 포함 | 대소문자 무시로 매칭 | FR-009 |
| E1 | `query` 누락 / 공백만 | 400 VALIDATION_ERROR | FR-008 |
| E2 | `page=-1` / `page=abc` | 400 VALIDATION_ERROR | FR-008 |
| E3 | 매칭 0건 | 200, 빈 content (오류 아님) | FR-002 |
| E4 | 토큰 없음/만료 | 401 INVALID_TOKEN / TOKEN_EXPIRED | FR-003 (B-A 후) |
| E5 | port 예외(내부 실패) | 500 INTERNAL_ERROR, 공통 실패 구조 | FR-008 |

## 지금 작성 가능한 테스트 (블로커 무관)

- 컨트롤러 슬라이스: E1·E2 (검증 → 400), E3·E5 (port를 MockitoBean으로 stub).
- A1~A6: port mock이 정해진 목록 반환 시 응답 조립·정렬 보존·페이지 정보 검증.

## 블로커 후 검증

- A2 좌표 일치·A4 실페이지·E4 인증: 실데이터(B-D)·Core 인증(B-A) 필요.
- 성능(p95<300ms 제안): B-D 후 벤치마크.
