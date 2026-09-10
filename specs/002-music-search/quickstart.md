# Quickstart: 음악 검색 검증 (2026-09-09 master 기준)

## 전제
- `cd backend && ./gradlew test` (JUnit + H2). Java 17.
- 컨트롤러 검증은 **standalone MockMvc**(R2: master @MapperScan+@WebMvcTest 충돌 회피). 서비스는 순수 유닛(mock port).
- 실데이터 통합·인증은 B-D/B-A 후.

## 검증 시나리오

| # | 요청 | 기대 | 대응 |
| --- | --- | --- | --- |
| A1 | `query=IU&page=0` (매칭) | 200, content + 페이지 정보 | FR-001·004 |
| A2 | 성공 응답 | MusicSummary 필드 + location baseline 일치 | FR-005·006 (실데이터 B-D) |
| A3 | youtubeUrl null 곡 포함 | 제외 안 됨, `youtubeUrl:null` | FR-007 |
| A4 | 매칭 11건+, page=1 | 10건 페이지, hasNext | FR-004 (실데이터 B-D) |
| A5 | youtubeCnt 300·100·200, id tie | DESC, 동률 id ASC | FR-010 |
| A6 | substring "wins" title/artist | 대소문자 무시 매칭 | FR-009 |
| E1 | query 누락/공백 | 400 `INVALID_INPUT` | FR-008 |
| E2 | page=-1 / abc | 400 `INVALID_INPUT` | FR-008 |
| E3 | 매칭 0건 | 200, 빈 content | FR-002 |
| E4 | 토큰 없음/만료 | 401 (코드 B-A) | FR-003 (B-A) |
| E5 | port 예외 | 500 `INTERNAL_SERVER_ERROR` | FR-008 |

## 지금 가능 (블로커 무관)
- 서비스 유닛(mock port): A2·A3·A4·A5 조립·정렬·페이지 계산, E5 예외.
- 컨트롤러 standalone MockMvc: A1·E3, 그리고 E1·E2(검증 매핑 동작 시 — R3 공통 핸들러 검증→400 반영 후 확실).

## 블로커 후
- A2 좌표·A4 실페이지: 실데이터(B-D, MyBatis 매퍼).
- E1·E2 400: 공통 GlobalExceptionHandler 검증→400 매핑(B-Common) 확정 후 안정.
- E4 401: Core 인증(B-A).
- 성능(p95<300ms): B-D 후 벤치.
