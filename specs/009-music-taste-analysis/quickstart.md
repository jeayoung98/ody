# Quickstart: Music Taste Analysis

## 구현 시나리오

"AI 기반 좋아요 음악 분포 및 취향 분석 리포트 기능을 추가해 주세요.

요구사항:
- 개별 곡 좋아요를 멱등 target-state API로 저장하고 현재 사용자의 좋아요만 분석한다.
- 마이페이지에서 좋아요 음악 전체를 최근 좋아요순 가상 플레이리스트로 조회하고 기존 큐로 재생한다.
- 고정된 16개 PC를 전체 서빙 카탈로그 백분위와 비교하며 사용자별 PCA를 수행하지 않는다.
- 유효 곡 10~29개는 초기 리포트, 30개 이상은 일반 리포트, 10개 미만은 분포만 제공한다.
- 리포트는 사용자가 요청할 때만 생성하고 성공 저장만 KST 날짜당 1회로 계산한다.
- 검증된 축 통계로 Backend가 finding을 정하고 GMS LLM은 문장만 생성한다.
- 마지막 성공 갱신 시각과 현재 좋아요 기준 최신 여부를 표시한다.

기술 조건:
- 사용할 라이브러리: 기존 Spring Boot 4.1.1, MyBatis, PostgreSQL, Spring RestClient, Jackson, Micrometer
- 에러 처리: GMS timeout·HTTP 오류·refusal·schema 오류는 동일 통계의 fallback으로 응답하고 quota를 차감하지 않는다. 기준 파일 오류는 TASTE_REFERENCE_UNAVAILABLE로 격리한다.

테스트:
- 9/10/29/30곡 경계와 분포/finding 계산을 검증한다.
- 동시 요청, KST 자정, 성공 차감, 실패 재시도, stale 판정을 검증한다.
- GMS 요청에서 개인정보와 곡 목록이 빠지고 strict JSON 응답만 수용되는지 검증한다."

## 선행 승인

1. 기획 담당자에게 [spec.md](./spec.md)의 신규 기능을 항목별로 승인받고 `docs/rules/FEATURES.md` 변경 제안에 반영한다.
2. Backend와 Frontend가 [contracts/openapi.yaml](./contracts/openapi.yaml)의 endpoint, 상태, 오류 코드와 `error.details` 확장을 합의한다.
3. Data 담당자가 [contracts/taste-reference.schema.json](./contracts/taste-reference.schema.json)에 맞는 기준 산출물과 축 라벨을 승인한다.
4. 개별 곡 좋아요가 S15P21A405-512 범위 밖이면 별도 Jira 이슈와 브랜치로 분리한다.

## 검증 준비

- [taste-reference schema](./contracts/taste-reference.schema.json)를 통과하는 16축 테스트 fixture와 실제 승인 artifact가 있어야 한다.
- 9·10·29·30개의 유효 좋아요를 가진 테스트 사용자를 준비한다.
- timeout, HTTP error, refusal, malformed JSON, 정상 JSON을 반환하는 로컬 GMS stub을 사용한다.
- 테스트는 주입된 `Clock`으로 KST 23:59:59와 다음 날 00:00:00을 재현한다.
- 동시 생성 검증은 같은 사용자의 두 요청을 동시에 시작할 수 있는 barrier를 사용한다.

## 환경 설정

```text
GMS_BASE_URL=https://gms.ssafy.io/gmsapi/api.openai.com/v1
GMS_API_KEY=<secret>
GMS_MODEL=gpt-4.1
GMS_CONNECT_TIMEOUT_MS=<agreed value>
GMS_READ_TIMEOUT_MS=<agreed value under 30s UX target>
TASTE_REFERENCE_RESOURCE=classpath:taste/taste-reference-v1.json
TASTE_ANALYSIS_ZONE=Asia/Seoul
```

`GMS_API_KEY`(예전 이름 `GMS_KEY` 도 인식)는 환경변수 또는 운영 secret store로만 주입한다. test profile은 실제 GMS를 호출하지 않고 로컬 HTTP server를 사용한다.

## 대표 수동 확인

```bash
curl -X POST http://localhost:8080/api/music/like \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"musicId":123,"liked":true}'

curl http://localhost:8080/api/taste-analysis \
  -H "Authorization: Bearer $TOKEN"

curl http://localhost:8080/api/music/liked \
  -H "Authorization: Bearer $TOKEN"

curl -X POST http://localhost:8080/api/taste-analysis \
  -H "Authorization: Bearer $TOKEN"
```

확인할 결과:

- 9곡: 생성 요청 422, GET 분포와 `additionalLikesNeeded=1`
- 10곡: `INITIAL`, 잠정 표현, 최대 3개 finding
- 30곡: `STANDARD`
- 성공 직후 같은 입력 재요청: 200 `generation.status=REUSED`, GMS 미호출, 갱신 시각 유지
- 성공 후 좋아요를 바꾼 같은 KST 날짜 재요청: 429와 다음 KST 자정
- GMS 실패: 200 `generation.status=FALLBACK`, `dailyLimitUsedToday=false`, 같은 날 재시도 가능
- 좋아요 변경 후 GET: 기존 report 보존, `fresh=false`, `lastRefreshedAt` 유지
- 좋아요 음악 목록: 최근 좋아요순 전체 곡이 반환되고 임의 곡부터 같은 순서로 기존 재생 큐가 구성됨

## 검증 명령

```bash
cd backend
./gradlew test
./gradlew build
```

성능 인수 검증은 유효 곡 10~1,000개, 동시 사용자 10명 조건으로 별도 측정한다. 분포/기존 리포트 p95 3초, 신규 생성의 결과 또는 명시적 fallback p95 30초를 확인하고 GMS 실패율은 따로 보고한다.

## 파트별 요청

**Data 파트**

- `taste-reference-v1.json` 생성 코드, source lineage, 16축 quantile, explained variance 제공
- 축 라벨의 verified status와 strength를 명시하고 PC5~PC16을 근거 없이 채우지 않음
- 서빙 bundle 승격/롤백 절차와 함께 artifact checksum 전달

**Frontend 파트**

- PC 8쌍 전환, 점 tooltip/겹침 수, 상대 분포와 표본 수 표시
- 마이페이지 좋아요 음악 전체 목록을 기존 `playQueue`와 `likedMusic` context로 연결
- EMPTY/DISTRIBUTION_ONLY/READY/IN_PROGRESS/FRESH/STALE/FALLBACK 상태와 GENERATED/REUSED 결과 출처 표시
- INITIAL 잠정 안내, AI 생성 표시, 마지막 갱신 시각, 다음 생성 가능 시각 표시
- 자동 생성 금지와 반복 클릭 방지

**Backend 파트**

- 계약과 상태 전이 구현, 데이터 artifact 검증, GMS 정보 최소화
- `FEATURES.md`·`BACKEND-NOTES.md` 변경은 항목별 승인 후 반영
