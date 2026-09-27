# Phase 1 — 검증 절차

**Date**: 2026-09-18 (갱신) | **Branch**: `backend/fix/S15P21A405-454-videoid-unplayable-state`

## 전제

- JDK 17, `backend/` 에서 Gradle 래퍼 사용
- **실제 videoid 서비스는 필요 없다.** 판정 번역을 보는 것이므로 HTTP 응답을 스텁으로 세운다

## 0. 선행 — 백필 (코드 배포보다 먼저)

```sql
UPDATE music SET is_unplayable = true WHERE video_id = 'none';
```

운영 쓰기이므로 **사람이 직접 실행한다.** 실행 전후 확인:

```sql
SELECT count(*) FILTER (WHERE is_unplayable) AS flagged,
       count(*) FILTER (WHERE video_id = 'none') AS marker
FROM music;
```

실행 전 `0 | 560`, 실행 후 `560 | 560` 이어야 한다. 건너뛰고 배포하면 560곡이 검색·지도에 되살아난다(SC-004 위반).

## 1. 자동 검증 (완료 조건)

```bash
cd backend && ./gradlew test
```

### 어댑터 판정 분기 (신규)

| 외부 응답 | 기대 결과 | 근거 |
| --- | --- | --- |
| `best` 에 videoId 있음 | 그 식별자 반환 | FR-001 |
| `best: null`, `playable: false`, `retryable: false` | **재생 불가** → 플래그 기록 | FR-001 |
| `best: null`, `retryable: true` | 빈 결과 → 기록 없음 | FR-002 |
| `best: null`, 두 필드 모두 없음 | 빈 결과 → 기록 없음 | FR-003 |
| **HTTP 200 인데 `retryable: true`** | 빈 결과 → 기록 없음 | FR-002 (`api.py` 의 예외 경로) |
| 읽기 시간 초과 | 빈 결과 → 기록 없음 | FR-002 |
| HTTP 400 (artist/title 누락) | 빈 결과 → 기록 없음 | Edge case |
| 모르는 필드가 섞인 응답 | 위 판정에 영향 없음 | FR-007 |

### 읽기 번역

| 저장 상태 | 다섯 경로 응답 `videoId` |
| --- | --- |
| `is_unplayable = true` | `"none"` |
| 11자 식별자 | 그 값 |
| 미판정 | `null` |

곡 상세 중심곡·이웃, 일괄 조회, 주변 탐색, 경로 정거장 **다섯 경로 전부** 같은 답을 내야 한다.

### 기존 테스트 (깨지면 안 된다)

```text
VideoIdEnricherTests                   조회·저장 기본 동작과 duration 전달
MusicVideoIdBatchServiceTests          일괄 조회가 곡 길이를 넘기는지
MusicSearchMapperVideoIdFilterTests    검색 4단계의 재생 불가 곡 제외
```

세 번째는 제외 조건이 `NOT is_unplayable` 로 바뀌므로 **조건 문자열을 함께 고쳐야 한다.** 나머지 둘은 무변경 통과가 맞다.

## 2. 빌드

```bash
cd backend && ./gradlew build
```

## 3. 전환 리허설 (권장)

새 서비스를 로컬에 띄우고 `ody.videoid.base-url` 을 그쪽으로 돌린 뒤 **판정이 계속 기록되는지** 본다.

```bash
cd data && .venv/Scripts/python.exe -X utf8 videoid/api.py --port 8001
```

```sql
-- 리허설 전후로 이 수가 늘어야 한다. 멈추면 판정이 사라진 것이다
SELECT count(*) FROM music WHERE is_unplayable;
```

재생 불가로 판정될 곡 하나를 골라 `POST /api/music/videoid` 를 **두 번** 호출한다.

- 첫 호출: `videoId` 가 `"none"` 으로 내려오고 플래그가 선다
- 둘째 호출: 같은 값이 내려오고 **외부 조회 로그가 없다**

## 4. 로그로 확인

판정이 끝난 곡을 반복 조회해도 아래가 찍히지 않아야 한다.

```text
[VideoId] 실시간 매핑 완료 musicId=...
```

시간 초과 시에는 아래가 찍히고 **DB 에는 아무것도 남지 않아야 한다**.

```text
[VideoId] 조회 실패 artist=... title=... error=...
```

## 5. 프론트 확인 (선택)

재생 불가 곡을 곡 상세에서 눌렀을 때 문구가 그대로인지 본다 — 이 변경의 성공 조건은 **"아무것도 달라지지 않는 것"** 이다.

```text
기대: "재생 불가 / 아직 준비 중인 곡이에요 … 신고 버튼으로 알려 주세요"
퇴행: "재생 준비 중 / 음원을 아직 찾는 중이에요. 잠시 후 다시 눌러 주세요"
```

## 되돌리기

코드 변경만 되돌리면 된다. 백필은 되돌릴 필요가 없다 — 플래그는 표시값과 같은 뜻이라 남아 있어도 무해하다.
