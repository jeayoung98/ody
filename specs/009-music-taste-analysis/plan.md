# Implementation Plan: AI 기반 좋아요 음악 분포 및 취향 분석 리포트

**Branch**: `backend/feat/S15P21A405-512-music-taste-analysis` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Input**: `/specs/009-music-taste-analysis/spec.md`

## Summary

사용자가 개별 곡에 좋아요를 표시하고, 좋아요 곡을 고정된 16차원 서빙 좌표계에서 전체 카탈로그 백분위와 비교해 분포를 확인하도록 한다. 사용자 표본에 PCA를 다시 적용하지 않는다. 백엔드는 버전 고정 기준 산출물로 통계를 계산하고 검증된 축 의미만으로 최대 3개의 finding을 만든다. SSAFY GMS를 통한 OpenAI Responses API는 이 finding을 한국어로 표현하는 역할만 맡는다. 생성은 버튼을 누른 경우에만 수행하고, 성공해 저장된 결과만 Asia/Seoul 날짜 기준 하루 1회로 계산한다.

## Technical Context

**Language/Version**: Java 17, TypeScript/Next.js(현재 프론트엔드)

**Primary Dependencies**: Spring Boot 4.1.1, Spring MVC/Security/JDBC, MyBatis 4.1, Jackson, Micrometer, Spring `RestClient`; 외부 AI SDK·LangChain 추가 없음

**Storage**: PostgreSQL(`music_like`, `taste_analysis`), classpath의 버전 고정 JSON 기준 산출물

**Testing**: JUnit 5, Spring MVC 테스트, JDK `HttpServer` 기반 GMS 클라이언트 계약 테스트, Gradle test/build

**Target Platform**: Linux 컨테이너의 Spring Boot API와 웹 클라이언트

**Project Type**: 웹 애플리케이션(백엔드 중심, 프론트엔드·데이터 파이프라인 계약 포함)

**Performance Goals**: 분포 조회는 외부 AI 호출 없이 처리한다. 생성 요청의 DB claim과 통계 계산은 짧은 트랜잭션으로 처리하고 GMS 호출은 설정된 제한 시간 안에 종료한다. 실제 p95 목표는 구현 전 운영 환경에서 합의한다.

**Constraints**: 16차원 좌표계 재학습 금지, bundle 혼합 금지, GMS에 개인정보·곡 목록 전송 금지, 비스트리밍 호출, 성공 저장만 일일 횟수 차감, KST 자정 초기화, 10곡 미만 생성 금지

**Scale/Scope**: 현재 서빙 기준선 `v2.1-pca16-2026-09-06`의 6,624,399곡과 16개 PC; 화면에는 고정된 8개 PC 쌍 제공

## Constitution Check

### Planning gate

| Principle | Result | Evidence / required follow-up |
| --- | --- | --- |
| I. Spec First | PASS for planning | [spec.md](./spec.md)에 범위와 인수 기준이 있다. Draft이므로 구현 전 `docs/rules/FEATURES.md` 항목별 팀 승인이 필요하다. |
| II. Contract First | PASS | [contracts/openapi.yaml](./contracts/openapi.yaml)과 [contracts/taste-reference.schema.json](./contracts/taste-reference.schema.json)을 구현 전에 정의한다. 승인 후 `FEATURES.md`와 `BACKEND-NOTES.md`를 동기화한다. |
| III. Test Before Done | PASS | API, 통계 경계, 동시성, KST 날짜, GMS 실패/스키마 검증을 자동화한다. |
| IV. Data Reproducibility | PASS | 기준 산출물에 bundle·reference·label 버전, 모집단 수, 생성 시점, source manifest/checksum을 기록한다. |
| V. Coordinate Stability | PASS | 기존 16차원 좌표만 읽고 사용자별 PCA를 수행하지 않는다. bundle 불일치는 요청을 실패시킨다. |
| VI. Exploration Consistency | PASS | 탐색 상태와 무관하게 같은 좋아요 집합·기준 버전은 같은 통계를 만든다. |
| VII. Experiment Isolation | PASS | 미검증 축 라벨은 서술 후보에서 제외하며 기준 산출물 승격은 데이터 팀 승인 대상으로 둔다. |
| VIII. Observability | PASS | 결과·실패 원인·GMS 지연·제한 거절을 메트릭으로 수집하고 PII와 원문 payload는 기록하지 않는다. |
| IX. No Silent Assumption | PASS with implementation gate | 축 라벨, API, 새 기능 명세는 팀 합의 전 확정으로 취급하지 않는다. 임계값은 `taste-v1`로 명시한다. |
| X. Architecture Boundaries | PASS | Backend는 통계·rate limit·GMS 어댑터, Data는 기준 산출물, Frontend는 표시와 사용자 동작을 담당한다. |

### Post-design gate

Phase 1 설계도 위 원칙을 충족한다. 구현 전 차단 항목은 (1) 팀 기능 명세 승인, (2) API/에러 코드에 대한 프론트엔드 합의, (3) 데이터 팀의 축 라벨과 기준 산출물 승인이다. 이는 설계상 미정값이 아니라 저장소 협업 정책에 따른 승인 단계다.

## Technical Design

### 1. Individual music likes

`music_like(email, music_id, created_at)`를 복합 기본키로 사용한다. `POST /api/music/like`는 `{musicId, liked}` 목표 상태를 받아 멱등적으로 추가·삭제한다. 존재하지 않는 곡은 404로 처리하고 반복 요청은 성공한 동일 상태로 끝낸다. `GET /api/music/liked`는 현재 사용자의 전체 목록을 최근 좋아요순으로 곡 정보와 함께 제공한다.

마이페이지는 이 응답의 music ID를 기존 `playQueue`에 전달해 가상 플레이리스트처럼 재생한다. 별도 `playlist`/`playlist_item` row나 전용 queue API를 만들지 않고 Frontend 재생 context에 `likedMusic` 한 종류만 추가한다.

이 기능은 분석의 선행 기능이며 기존 플레이리스트 좋아요와 별도 도메인이다. 현재 Jira 범위를 확인해 별도 이슈가 필요하면 구현 태스크를 분리하고 같은 브랜치에 섞지 않는다.

### 2. Catalog-relative statistics

데이터 파이프라인은 각 PC의 0~100 백분위 cut point 101개와 설명분산, 검증된 양·음 방향 라벨을 `taste-reference-v1.json`으로 생성한다. Backend는 시작 시 파일을 한 번 읽고 schema와 bundle 호환성을 검증한다.

현재 좋아요 중 유효 좌표만 사용하여 축마다 원 좌표의 min/Q1/median/Q3/max, 카탈로그 percentile로 변환한 동일 통계, IQR, 10-bin histogram을 계산한다. 분포 화면은 PC1–PC2부터 PC15–PC16까지 고정 8쌍을 제공한다. 유효 곡 수가 10 미만이면 분포만 반환하고, 10~29는 `INITIAL`, 30 이상은 `STANDARD` 리포트다.

### 3. Deterministic findings

`taste-v1` 정책은 라벨 상태가 verified이고 강도가 strong 또는 medium인 축만 사용한다.

- `abs(medianPercentile - 50) >= 15`: 방향 편향 후보
- 방향 편향이며 `IQR <= 30`: 일관된 편향
- `IQR >= 50`: 다양한 분포
- 양 끝에 걸친 넓은 분포는 중간 선호로 표현하지 않음
- 일관된 편향, 편향, 다양성 순으로 정렬하고 효과 크기와 PC 번호로 안정 정렬하여 최대 3개 선택
- 후보가 없으면 검증 가능한 범위에서 균형/다양성 기본 finding 생성

임계값과 정렬 규칙은 `analysisPolicyVersion=taste-v1`에 묶는다. LLM 출력은 finding ID별 문구만 허용하며 숫자와 방향의 진실 원천은 Backend가 된다.

### 4. GMS generation

Spring `RestClient`로 `https://gms.ssafy.io/gmsapi/api.openai.com/v1/responses`에 Bearer GMS key를 사용해 비스트리밍 요청한다. 기본 모델은 GMS 예시의 `gpt-4.1`이며 환경변수로 교체한다. `store=false`, 최대 출력 토큰, strict JSON Schema를 설정한다.

입력에는 report level, 검증된 축 라벨, 선택된 finding ID·방향·효과만 포함한다. 사용자 이메일, 곡 ID/제목, 전체 좋아요 목록, 원시 좌표는 보내지 않는다. 출력 `{summary, narratives:[{findingId,text}]}`를 schema와 finding ID allowlist로 검증한다. timeout·HTTP 오류·refusal·잘못된 JSON·허용되지 않은 finding은 통계 기반 fallback으로 처리하며 자동 재시도하지 않는다.

### 5. Daily generation state and concurrency

`taste_analysis`의 기본키는 `(email, analysis_date)`이며 날짜는 요청 수락 시점의 `Asia/Seoul` 날짜다. `PENDING`, `SUCCESS`, `FAILED` 상태와 lease를 둔다.

1. 현재 snapshot hash와 version tuple을 계산한다. 최신 성공 결과와 모두 같으면 GMS를 호출하거나 시각을 갱신하지 않고 `REUSED`로 반환한다.
2. 재사용할 결과가 없으면 짧은 트랜잭션에서 해당 날짜 row를 조건부 claim한다.
3. 같은 사용자의 다른 날짜에 유효한 `PENDING`이 있으면 자정이 지나도 중복 생성을 409로 막는다.
4. 해당 날짜에 `SUCCESS`가 있으나 현재 입력은 달라졌으면 429와 다음 KST 갱신 가능 시점을 반환한다.
5. `FAILED` 또는 만료된 `PENDING`은 다시 claim할 수 있다.
6. 트랜잭션 밖에서 GMS를 호출한다.
7. 검증된 결과 저장까지 성공하면 `SUCCESS`; 실패하면 `FAILED`로 바꾼다.

GMS 제한 시간보다 긴 lease를 사용한다. 실패는 횟수를 차감하지 않고 마지막 성공 시점을 바꾸지 않는다. 실패 응답에도 현재 분포와 통계 기반 fallback을 제공한다.

`INITIAL`의 잠정 경향 안내는 LLM이 생성하거나 생략할 수 있는 문구로 두지 않고 Backend 응답 필드와 고정 UI 문구로 보장한다.

### 6. Freshness

성공 결과에는 정렬된 유효 music ID 집합의 SHA-256, bundle/reference/axis-label/analysis-policy/prompt 버전을 저장한다. `GET /api/taste-analysis`는 현재 집합으로 통계를 계산하고 최신 성공 리포트를 함께 반환한다. hash와 모든 버전이 같을 때만 `fresh=true`다. 생성 중 좋아요가 바뀌면 생성 스냅샷 결과는 보존하되 즉시 stale로 표시한다.

### 7. Observability and security

요청·성공·fallback·표본 부족·일일 제한·진행 중 충돌·기준 파일 오류·GMS 실패를 counter로, GMS 지연을 timer로 기록한다. 로그와 metric label에는 이메일, GMS key, 곡 ID 목록, 요청/응답 원문을 넣지 않는다. GMS active health check는 두지 않고 시작 시 로컬 기준 산출물만 검증한다.

## Project Structure

### Documentation (this feature)

```text
specs/009-music-taste-analysis/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── openapi.yaml
│   ├── gms-output.schema.json
│   └── taste-reference.schema.json
└── tasks.md                 # $speckit-tasks 단계에서만 생성
```

### Source Code (planned)

```text
backend/src/main/java/com/ssafy/backend/
├── music/like/              # 개별 곡 좋아요 controller/service/mapper/model
└── taste/                   # 분석 API, 통계, finding, persistence
    └── gms/                 # GMS RestClient adapter와 DTO

backend/src/main/resources/
├── db/                      # music_like, taste_analysis SQL
└── taste/                   # 승인된 taste-reference-v1.json

backend/src/test/java/com/ssafy/backend/
├── music/like/
└── taste/

frontend/src/                # Frontend 파트 요청 범위
data/                        # Data 파트 요청 범위
```

**Structure Decision**: 기존 Spring Boot backend 안에 `taste` 경계를 두고, 기존 `report` 패키지는 신고 기능이므로 재사용하지 않는다. 새 SDK·서비스·저장소 추상화는 추가하지 않고 현재 Controller–Service–MyBatis/RestClient 관례를 따른다. Frontend와 Data 파일은 각 담당 파트가 별도 이슈·브랜치에서 구현한다.

## Verification Strategy

- 통계 단위 테스트: 9/10/29/30 경계, percentile cut point, IQR, 넓은 양봉 분포, NaN/차원 불일치 제외, finding 안정 정렬
- persistence 통합 테스트: 좋아요 멱등성, 같은 날짜 SUCCESS 차단, FAILED 재시도, 만료 lease 회수, 자정 경계, 동시 요청 한 건만 claim
- GMS 테스트: endpoint/header/body, timeout, HTTP 오류, refusal, malformed JSON, unknown finding ID, fallback
- API 테스트: 인증, 응답 envelope, 404/409/422/429/503, lastRefreshedAt·nextAvailableAt·fresh·reportLevel
- 기준 산출물 테스트: JSON Schema, 16축/101 quantiles, 단조성, version/bundle 일치
- Backend 완료 전 `./gradlew test`와 `./gradlew build`; Frontend 담당은 `npm run lint`, `npm test`, `npm run build`
- 운영 smoke: key를 노출하지 않고 SUCCESS 1회, 동일 입력 재요청 REUSED, 입력 변경 후 같은 날 재요청 429, 실패 환경에서 fallback·재시도 가능 확인

## Deployment and Rollback

배포 순서는 승인된 기준 산출물, DB SQL, GMS 환경변수, Backend, smoke test, Frontend다. `GMS_KEY`, `GMS_MODEL`, base URL, connect/read timeout을 배포 시 주입하며 key는 저장소나 로그에 남기지 않는다.

롤백은 이전 Backend와 기준 산출물 조합으로 되돌린다. 새 테이블은 기존 기능과 독립적이므로 즉시 삭제하지 않는다. 기준 bundle이 맞지 않으면 취향 API만 503으로 닫고 기존 음악 기능은 계속 제공한다.

## Complexity Tracking

헌법 위반은 없다. PostgreSQL 상태 row는 일일 제한·동시성·결과 이력을 한 경계에서 해결하므로 Redis lock이나 별도 queue를 추가하지 않는다. 직접 `RestClient`를 사용해 OpenAI SDK와 LangChain 의존성을 피한다.
