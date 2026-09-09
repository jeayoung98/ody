# 11 여정 — spec

상태 ⬜ · 목표일 09-09 · 결정 D2(linear 기본, axis 내부 플래그), D3(항상 잇기, far 표시, 역 수 증가)

## 목적
출발곡 A 에서 도착곡 B 까지 "분위기가 조금씩 바뀌는" 곡 열 n개(기본 10)를 돌려준다. 어떤 두 곡을 넣어도 항상 경로가 나온다.

## 입력·출력
`GET /journeys?from={mbid}&to={mbid}&n=10&mode=linear`
```
{ from: {...}, to: {...}, endpoint_dist, far: bool, n_stations, mode: "linear"|"axis"|"linear_polyline",
  stations: [{rank, mbid, title, artist, dist_from_prev, progress(0..1), off_axis, leaf_id, node_d2, is_graph_edge_from_prev}],
  last_to_end, path_nodes_d2: [...], bundle, rules }
```
- `far = endpoint_dist > 10.7` (정답쌍 median). `n` 미지정 시 `n = clamp(round(10 + (endpoint_dist − 10.7)), 10, 20)`.
- `mode` 기본 `linear`. `axis` 는 내부 A/B 용(게이트웨이가 일부 요청에만 부여). `linear_polyline` 은 far 여정에서 리프 중심 그래프 경로를 따라 보간(시간 되면 1차, 기본은 far 도 `linear`).

## 규칙
- 역은 A·B 와 같은 canonical 제외, 아티스트당 ≤ 2, 길이 규칙·`excluded`·제목 없음 제외, `flag_*` 후순위.
- `linear`: 16-D 직선을 (n+1) 등분한 지점마다 가장 가까운 미사용 곡 (`scripts/qual_prepare.py` journey 로직 이식).
- `axis`: `scripts/journey_smooth.py` 축 우선 DP (전이 ≤ τ_far, λ=2, μ=0.5, 이웃 간선 제약 없음) 이식. 층 후보 M=400.
- `linear_polyline`: 리프 중심 4,096 그래프(간선 = 중심 거리 ≤ 임계) A* → 꺾인 선 → 누적 길이 등분 지점마다 최근접 곡.

## 수용 기준
- AC1 임의 (from, to) 100쌍(브릿지 무작위, 거리 3~25): 100% 응답(경로 없음 0건), `linear` p95 ≤ 2s, `axis` p95 ≤ 5s.
- AC2 역 규칙 위반 0 (canonical 중복·아티스트 > 2·제외 곡·길이 위반), 진행도 단조 증가.
- AC3 기록된 두 기준 여정(2AM→WIN, CHEEZE→Drake)의 `linear` 결과가 `work/qual/journeys.json` 과 동일 (이식 검증). `axis` 결과가 `journeys_smooth.json` 의 축 우선 DP 와 동일.
- AC4 far 여정(거리 15.29)에서 n=15 자동, `far:true`.
- AC5 `pytest tests/test_journey.py` 통과.

## 비범위
여정 저장·공유, 사용자 피드백 수집(→ 2차, A/B 로그는 게이트웨이 책임).
