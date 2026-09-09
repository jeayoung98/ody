# Quickstart: 노래 상세 조회 (Nearby 포함) 검증

master 미해결 게이트(B-A 인증, B-D 저장소·KNN 실행) 전에는 **port mock 기준**으로 BE2 슬라이스를 검증한다.
실좌표·실제 KNN 정렬·인증(401)은 B-D/B-A 도착 후 어댑터·통합 테스트로 완결.

## 전제

- standalone MockMvc(`standaloneSetup(new MusicController(service)).setControllerAdvice(new GlobalExceptionHandler())`).
- `MusicDetailReader`는 Mockito mock. 서비스 유닛은 mock reader로 직접.

## 시나리오 (spec Acceptance ↔ 검증)

| # | Given | When | Then | FR |
| --- | --- | --- | --- | --- |
| Q1 | mock: findDetail(10234)=상세, findNeighbors=10곡 | `GET /music/detail?id=10234` | 200, data에 MusicDetail 전 필드 + neighbors[10], `error:null` | FR-001,004,006,008 |
| Q2 | mock 상세 location = baseline 좌표 | Q1 | 응답 location = mock 좌표 그대로(변형 0) | FR-005 |
| Q3 | mock 상세 youtubeUrl=null | `GET ...?id=X` | 200, youtubeUrl:null 유지 | FR-012 |
| Q4 | mock neighbors에 youtubeUrl:null 포함 | Q1 | 해당 항목 제외 없이 포함 | FR-007 |
| Q5 | mock: findDetail(999)=empty | `GET /music/detail?id=999` | 404, `MUSIC_NOT_FOUND`, `success:false`,`data:null` | FR-003,011 |
| Q6 | — | `GET /music/detail?id=0` / `id=abc` / 누락 | 400, `INVALID_INPUT` | FR-011 |
| Q7 | mock findNeighbors=3곡(후보 부족) | Q1 | neighbors 3곡, 200(오류 아님) | FR-006 |
| Q8 | reader 빈(Optional.empty 주입) | `GET ...` | UnsupportedOperationException(B-D 대기) 노출 — 어댑터 도착 전 명시 실패 | (B-D) |

## 계약 이관(어댑터/통합 단계, B-D/B-A 후)

- neighbors 실제 정렬(distance ASC·id ASC)·자기 제외·최근접성: MyBatis 어댑터 SQL + 실데이터 테스트(FR-006,009).
- 인증 401(E-Auth): Core 인증 도착 후.
- 관측: actuator `http.server.requests`에 404/500 태그 확인(헌법 VIII).

## 실행

```bash
cd backend && ./gradlew test --tests '*MusicDetail*'
```
