# 탐색 설문 — 주변 탐색·범위 탐색 곡 단위 피드백

작성 2026-09-13 · Jira S15P21A405-289 · 원본 `docs/notion/product/01_EXPLORE_SURVEY.md` (Notion 에서 고치면 저장소에도 반영)

## 1. 왜 받나

지도의 좌표는 minor 버전에서 바꾸지 않는다(아티팩트 계약 AC3: `coords`·`split_axes`·`model_bundle` 해시 동일). 우리가 바꿀 수 있는 것은 **후처리 규칙**(`tau_dup` 1.6624 · `artist_cap` 3 · `tau_far` 4.912 · 길이 30~1200s · hub 벌점)과 **여정 DP 파라미터**(방식 linear/axis, 곡률 벌점, 축 이탈 벌점, 간선 허용 방식)다. 설문은 이 조정의 근거이고, 규칙으로 못 고치는 오차가 얼마나 되는지(= major 재학습 안건) 가늠하는 눈금이다.

팀 내부 정성 평가(`data/docs/qual_eval_form.md`)와 같은 척도(O/X + 결함 코드)를 쓴다. 그래서 사용자 응답과 내부 채점을 한 표에서 합쳐 볼 수 있다.

## 2. 사용자에게 보이는 것

곡 하나가 **끝나거나 스킵될 때** 질문 1개. 탭 1번. 👎 일 때만 이유 칩 1번 더. 최대 2탭.

| 모드 | 질문 | 답 | 👎 일 때 이유 칩 |
|---|---|---|---|
| 주변 탐색 | 기준곡과 비슷했나요? | 👍 / 👎 | 분위기 다름 · 템포 다름 · 같은 곡이잖아 · 음악 아님 |
| 범위 탐색(여정) | 앞 곡에서 자연스럽게 이어졌나요? | 👍 / 👎 | 갑자기 바뀜 · 템포 다름 · 같은 곡 반복 · 음악 아님 |

규칙
- 강제하지 않는다. 몇 초 뒤 자동으로 사라진다. 무응답도 `verdict=null` 로 보낸다(스킵·청취 시간은 남는다).
- 스킵 순간에도 띄운다. 의견이 가장 강한 순간이다.
- 비로그인 사용자 응답도 저장한다.
- 5점 척도·자유 텍스트 없음. 내부 채점이 O/X 라 척도를 맞추고, 탭 수를 늘리지 않는다. "고민되면 👎".

이유 칩 4개는 내부 결함 코드와 1:1 이고 각각 고칠 곳이 다르다. 그래서 이 4개만 받는다.

| 칩 | 코드 | 뜻 | 조정 대상 (주변 탐색) | 조정 대상 (여정) |
|---|---|---|---|---|
| 같은 곡 | `dup` | 같은 녹음의 다른 판이 이어 나옴 | `tau_dup` 상향, canonical 키(아티스트+제목) 정규화 | `tau_dup`, `ART_CAP` 3→2 |
| 음악 아님 | `spoken` | 말·낭독·효과음 | `exclusion_rules.json` R2 키워드 추가, `flag_spoken`·`flag_fieldrec` 곡을 추천에서 제외 | 여정 후보에서 `flag_*` 곡 제외 |
| 템포 다름 | `tempo` | 분위기는 비슷한데 빠름·느림 차이 | 재정렬에 `bpm` 차이 벌점 추가 (좌표 가중은 major 라 불가) | 간선 비용에 bpm 차이 항 |
| 분위기 다름 | `mood` | 소리 자체가 다름 | `tau_far` 하향, hub 벌점, top-K 축소. **거리 작은데도 많으면 좌표 문제 = major 재학습 근거** | 방식 선택(linear/axis/A*), 곡률 벌점 `MU_CURV`, 축 이탈 `LAMBDA_AXIS`, 간선 허용(`neighbor_edge` vs `relaxed_tau_far`) |

## 3. 저장하는 것

row 1개 = 곡 1개 재생. 테이블 `explore_feedback` (DDL `backend/src/main/resources/db/explore_feedback.sql`).

| 컬럼 | 뜻 |
|---|---|
| `session_id` | 탐색 1회. 결과 목록을 받을 때 FE 가 uuid 생성 |
| `mode` | `nearby` / `journey` |
| `rank` | nearby: 이웃 순위 1~10 / journey: `path[].step` 1~ |
| `anchor_music_id` | nearby: 기준곡 / journey: 출발곡 |
| `target_music_id` | journey: 도착곡 |
| `prev_music_id` | journey: 앞 역 (1역은 출발곡) |
| `music_id` | 평가 대상 곡 |
| `verdict` | true / false / NULL(무응답) |
| `reason` | `dup` `mood` `tempo` `spoken` / NULL |
| `listened_sec`, `skipped` | 암묵 신호. 사용자에게 묻지 않고 자동 수집 |
| `user_email` | 로그인 시. 비로그인 NULL |
| `bundle`, `rules` | 서버가 찍는 좌표계 버전(`v2.1-pca16`)과 임계값 스냅샷(`dup=1.6624,cap=3,far=4.912,len=30-1200`). 규칙 바꾼 뒤 전후 비교 |

저장하지 않는 것: 거리, bpm 차이, 곡 길이. 전부 `music` 테이블에 있으니 분석 시 조인한다(`music.location` 은 pgvector, `<->` 가 L2 거리). 여정 응답은 거리를 노출하지 않아 FE 가 보낼 수도 없다.

`UNIQUE(session_id, rank)`. 답을 바꾸면 같은 행이 갱신된다.

## 4. API

`POST /api/feedback` · 인증 선택 (정본 `docs/api-spec.md` §5.1).

```json
{ "sessionId": "6f1a2b3c-...", "mode": "nearby", "rank": 3,
  "anchorMusicId": 10234, "targetMusicId": null, "prevMusicId": null, "musicId": 10877,
  "verdict": false, "reason": "mood", "listenedSec": 42, "skipped": true }
```
응답 `{ "success": true, "data": { "feedbackId": 7 } }`. 잘못된 값은 400 `INVALID_INPUT`.

FE 연동 메모
- 주변 탐색: `/api/music/nearby` 응답을 받을 때 `sessionId` 생성. 곡마다 `rank` = `neighbors` 순서(1부터), `anchorMusicId` = `center.id`.
- 여정: `/api/music/journey` 응답을 받을 때 `sessionId` 생성. `rank` = `path[].step`, `anchorMusicId` = `path[0].id`, `targetMusicId` = 마지막 곡, `prevMusicId` = `path[step-1].id`. 출발곡(step 0)은 설문 없음.
- 곡이 끝나거나 스킵될 때 fire-and-forget. 응답을 기다려 UI 를 막지 않는다.

## 5. 뽑을 수 있는 것 (분석 SQL)

정밀도 = 응답한 곡 중 👍 비율. 번들·규칙별로 나눠 배포 전후를 비교한다.
```sql
SELECT mode, bundle, rules,
       count(*) FILTER (WHERE verdict IS NOT NULL) AS answered,
       round(avg(verdict::int) FILTER (WHERE verdict IS NOT NULL), 3) AS precision,
       round(avg(skipped::int), 3) AS skip_rate
FROM explore_feedback
GROUP BY mode, bundle, rules ORDER BY mode, bundle, rules;
```

거리 구간별 정밀도. `tau_far` 4.91 경계가 맞는지, `mood` 가 먼 구간에 몰리는지(규칙으로 해결) 가까운 구간에도 많은지(좌표 문제) 본다.
```sql
SELECT f.mode,
       width_bucket(a.location <-> m.location, 0, 8, 8) AS dist_bucket,   -- 폭 1.0, 8 초과는 9
       count(*) AS n,
       round(avg(f.verdict::int) FILTER (WHERE f.verdict IS NOT NULL), 3) AS precision,
       count(*) FILTER (WHERE f.reason = 'mood') AS mood
FROM explore_feedback f
JOIN music m ON m.id = f.music_id
JOIN music a ON a.id = COALESCE(f.prev_music_id, f.anchor_music_id)   -- nearby: 기준곡 / journey: 앞 역
GROUP BY f.mode, dist_bucket ORDER BY f.mode, dist_bucket;
```

이유 분포. `dup` 많으면 `tau_dup`, `spoken` 많으면 정제 규칙, `tempo` 많으면 bpm 벌점.
```sql
SELECT mode, reason, count(*) FROM explore_feedback
WHERE verdict = false GROUP BY mode, reason ORDER BY mode, count(*) DESC;
```

`tempo` 응답과 실제 bpm 차이 상관. bpm 벌점 항을 넣을 근거.
```sql
SELECT f.reason = 'tempo' AS said_tempo,
       round(avg(abs(m.bpm - a.bpm)), 1) AS mean_bpm_diff, count(*) AS n
FROM explore_feedback f
JOIN music m ON m.id = f.music_id
JOIN music a ON a.id = COALESCE(f.prev_music_id, f.anchor_music_id)
WHERE f.verdict = false AND m.bpm IS NOT NULL AND a.bpm IS NOT NULL
GROUP BY 1;
```

여정: 역 번호별 끊김률. 어느 구간에서 흐름이 깨지는지.
```sql
SELECT rank AS step,
       count(*) FILTER (WHERE verdict IS NOT NULL) AS answered,
       round(1 - avg(verdict::int) FILTER (WHERE verdict IS NOT NULL), 3) AS break_rate
FROM explore_feedback WHERE mode = 'journey'
GROUP BY rank ORDER BY rank;
```

스킵과 👎 일치도. 무응답 곡을 스킵으로 부정 추정할 수 있는지 확인.
```sql
SELECT skipped, verdict, count(*) FROM explore_feedback
GROUP BY skipped, verdict ORDER BY skipped, verdict;
```

## 6. 아직 안 한 것

- 프론트 설문 UI (별도 이슈).
- 여정 방식(linear/axis) 컬럼. 여정 응답이 방식을 노출하지 않아(FR-023) 지금은 기록 불가. 응답에 방식이 추가되면 컬럼 하나 추가.
- 집계 API. 위 SQL 을 직접 실행한다. 대시보드가 필요해지면 그때.
