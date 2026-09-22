# Data Model: Music Taste Analysis

## Entity: music_like

사용자가 직접 표시한 개별 곡 좋아요의 현재 상태다.

| Field | Type | Constraints |
| --- | --- | --- |
| email | varchar | PK, user FK 또는 기존 사용자 식별 규칙 적용 |
| music_id | bigint | PK, music FK |
| created_at | timestamptz | NOT NULL, server-generated |

Indexes:

- Primary key `(email, music_id)`: 중복 제거와 target-state 멱등성
- `(email, created_at DESC, music_id DESC)`: 사용자 목록 조회

Deletion of a row represents `liked=false`. 이벤트 횟수나 가중치는 저장하지 않는다.

### Derived view: liked music virtual playlist

별도 entity를 저장하지 않는다. `music_like`를 `music`과 조인해 `created_at DESC, music_id DESC`로 정렬한 전체 목록이 마이페이지의 가상 플레이리스트다. 응답의 music ID 순서를 기존 Frontend 재생 큐에 그대로 전달하며, 실제 `playlist`와 `playlist_item`에는 복사하지 않는다.

## Entity: taste_analysis

한 사용자의 KST 날짜별 AI 생성 시도 상태와 성공 snapshot이다.

| Field | Type | Constraints / meaning |
| --- | --- | --- |
| email | varchar | PK part 1 |
| analysis_date | date | PK part 2, 요청 수락 시점의 Asia/Seoul 날짜 |
| status | varchar | `PENDING`, `SUCCESS`, `FAILED` |
| requested_at | timestamptz | 현재 attempt 시작 |
| lease_expires_at | timestamptz | PENDING 복구 기준 |
| completed_at | timestamptz nullable | 성공/실패 종료 |
| liked_set_hash | char(64) nullable | 좌표 유효 여부와 무관한 전체 좋아요 music ID와 version tuple의 SHA-256 |
| total_liked_count | integer nullable | 생성 snapshot의 전체 좋아요 수 |
| valid_music_count | integer nullable | 좌표 검증을 통과한 수 |
| excluded_music_count | integer nullable | 제외 수 |
| report_level | varchar nullable | `INITIAL` 또는 `STANDARD` |
| bundle_version | varchar nullable | 서빙 PCA bundle |
| reference_version | varchar nullable | percentile 기준 |
| axis_label_version | varchar nullable | 검증 라벨 |
| analysis_policy_version | varchar nullable | finding 규칙, 최초 `taste-v1` |
| prompt_version | varchar nullable | GMS prompt/schema 버전 |
| model | varchar nullable | 실제 요청 모델 |
| axis_stats | jsonb nullable | 16축 snapshot 통계 |
| findings | jsonb nullable | Backend가 결정한 finding |
| summary | text nullable | 검증된 AI 한줄 요약 |
| narratives | jsonb nullable | finding ID별 설명 |
| gms_response_id | varchar nullable | 운영 추적용 provider response ID |
| failure_code | varchar nullable | 분류된 실패 코드, 원문/비밀정보 금지 |

Indexes:

- Primary key `(email, analysis_date)`
- 최신 성공 조회용 partial index `(email, completed_at DESC) WHERE status='SUCCESS'`
- 사용자별 생성 중복 방지용 partial unique index `(email) WHERE status='PENDING'`

만료 회수는 사용자별 PENDING 한 건을 찾아 처리하므로 위 unique index를 사용한다. 전체 만료 행을 검색하는 별도 작업이 없어 lease 전용 index는 두지 않는다. 시각은 `requested_at`, `completed_at`으로 관리한다.

Constraints:

- count는 모두 0 이상이며 `total = valid + excluded`
- SUCCESS는 `completed_at`, 모든 version, hash, stats, findings, summary, narratives를 요구
- FAILED는 `failure_code`를 요구하고 성공 결과 필드는 소비 가능한 결과로 간주하지 않음
- PENDING lease는 필수이며 requested_at 이후

## Value Object: AxisStatistics

| Field | Meaning |
| --- | --- |
| pc | 1..16 |
| raw | min, q1, median, q3, max |
| percentile | min, q1, median, q3, max, iqr |
| histogram | 0–10부터 90–100까지 10개 count |
| explainedVariance | 해당 PC의 기준 bundle 설명분산 |
| label | verified 여부, strength, low/high 방향 문구 |

## Value Object: TasteFinding

| Field | Meaning |
| --- | --- |
| id | snapshot 안에서 유일하고 LLM 출력 allowlist에 사용 |
| type | `CONSISTENT_BIAS`, `BIAS`, `DIVERSE`, `BALANCED` |
| pc | 근거 축 |
| direction | `LOW`, `HIGH`, `BOTH`, `CENTER` |
| effectSize | 정렬용 절대 편차 또는 IQR |
| evidence | median percentile, IQR 등 Backend 계산값 |
| axisPhrase | 승인된 축 라벨에서 가져온 표현 |

## State transitions

```text
NONE ──claim──> PENDING ──validated save──> SUCCESS
                    └────failure─────────> FAILED ──retry claim──> PENDING
                    └────lease expiry───────────────────────────> PENDING(new attempt)

SUCCESS: 해당 analysis_date에는 terminal, 추가 생성 불가
```

같은 사용자의 PENDING은 날짜와 관계없이 하나만 허용한다. 사용자별 partial unique index와 날짜별 조건부 UPSERT가 이를 보장한다. 만료된 PENDING은 먼저 FAILED로 전환한다. 외부 GMS 호출 동안 lock/transaction은 유지하지 않는다.

`REUSED`는 저장 상태가 아니다. 현재 snapshot hash와 version tuple이 최신 SUCCESS와 같을 때 API가 계산해 반환하며 새 row, 새 생성 시각, 새 quota 사용을 만들지 않는다. 같은 날짜 SUCCESS가 있어도 입력이 달라 재사용할 수 없을 때만 새 생성 요청을 일일 제한으로 거절한다.

## Derived freshness

`fresh`는 저장 필드가 아니라 조회 시 계산한다. 현재 전체 좋아요 ID hash와 다음 version tuple이 성공 snapshot과 모두 같을 때 true다.

- bundleVersion
- referenceVersion
- axisLabelVersion
- analysisPolicyVersion
- promptVersion

좋아요가 추가/삭제되거나 어느 버전이 바뀌면 기존 성공 리포트는 남지만 `fresh=false`다.
