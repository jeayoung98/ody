# Validation: Music Taste Analysis

검증일: 2026-09-21
브랜치: `backend/feat/S15P21A405-512-music-taste-analysis`
기준: `origin/backend/dev` 커밋 `2d434fc` 위에서 구현

## 자동 검증

| 시나리오 | 결과 | 근거 |
|---|---|---|
| 좋아요 9곡 | 통과 | 분포는 반환하고 `additionalLikesNeeded=1`, 생성 요청은 `TASTE_INSUFFICIENT_SAMPLE`로 거부 |
| 좋아요 10곡 | 통과 | `INITIAL` 리포트 자격 부여 |
| 좋아요 29곡 | 통과 | `INITIAL` 유지 |
| 좋아요 30곡 | 통과 | `STANDARD`로 전환 |
| 같은 snapshot 재요청 | 통과 | 저장 결과를 `REUSED`로 반환하고 GMS를 호출하지 않음 |
| 성공 후 좋아요 변경 당일 재요청 | 통과 | 429와 다음 KST 자정 `nextAvailableAt` 반환 |
| 활성 생성 lease | 통과 | GET은 `IN_PROGRESS`, 중복 POST는 409와 lease 만료 시각 반환 |
| 생성 중 좋아요 변경 | 통과 | 생성에 사용한 분포를 보존하고 완료 응답을 즉시 `STALE`로 표시 |
| lease 만료 후 재claim | 통과 | terminal update가 `requestedAt`까지 비교하여 이전 attempt의 덮어쓰기를 차단 |
| GMS 실패 | 통과 | `FALLBACK`, 일일 한도 미차감, 재시도 가능 |
| GMS 요청 최소화 | 통과 | `/v1/responses`, Bearer 인증, `store=false`, strict schema 사용; 이메일·곡 ID·제목 미전송 |
| GMS grounding | 통과 | unknown finding, 승인 axisPhrase 누락, 근거 없는 장르 추론을 거부하고 fallback 처리 |
| 기준 산출물 오류 격리 | 통과 | 로더 검증 실패가 애플리케이션 기동을 막지 않고 취향 API에서 503 처리 |
| 개별 곡 좋아요 | 통과 | target-state 멱등 처리, 취소, 없는 곡 오류, 최근 좋아요순 가상 플레이리스트 검증 |

실행 결과:

```text
backend/gradlew.bat cleanTest test build
BUILD SUCCESSFUL in 1m 1s
```

전체 817개 중 72개는 기존 조건부 테스트로 skipped됐고, 실행된 745개는 failure 0, error 0으로 통과했다.

## 배포 전 필수 항목

### Data/DB 파트

- 승인된 `taste-reference-v1.json`과 checksum/lineage를 생성해 Backend에 전달한다. 전달 전에는 기존 API만 정상 기동하고 취향 분석 API는 `TASTE_REFERENCE_UNAVAILABLE`을 반환한다.
- `music_like_001_table.sql`, `taste_analysis_001_table.sql`을 검토해 staging·운영 PostgreSQL에 적용한다.
- 실제 PostgreSQL에서 claim, partial unique index, lease 회수와 FK/index 동작을 검증한다. 현재는 SQL 계약 테스트만 통과했다.

### Frontend 파트

- 곡 좋아요 UI와 최근 좋아요순 가상 플레이리스트를 기존 재생 큐에 연결한다.
- PC 분포 차트, 분석 생성 버튼, 1일 1회 제한, 생성 상태, 마지막 갱신 시각과 오류 상태를 표시한다.

### Infra 파트

- 운영 서버 secret 환경변수로 `GMS_KEY`를 주입하고 `gms.ssafy.io:443` outbound HTTPS를 허용한다.
- 실제 GMS staging 호출과 key·Authorization header 비노출을 검증한다.
- Actuator/Prometheus 지표 노출과 10~1,000곡 및 동시 사용자 10명 성능을 검증한다.
