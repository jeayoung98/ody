# 10 이웃 검색 (주변 탐색) — spec

상태 ⬜ · 목표일 09-08 · 결정 D4(FastAPI)

## 목적
카탈로그 곡 하나를 주면 "이어 들어도 어색하지 않은" 곡 10개를 후처리 규칙까지 적용해 50ms 안에 돌려준다. 진입점으로 제목·아티스트 텍스트 검색을 제공한다.

## 입력·출력
`GET /songs/{mbid}/neighbors?k=10&include_excluded=false`
```
{ query: {mbid, title, artist, leaf_id, node_d2, length_s, is_korean, genre?},
  neighbors: [{rank, mbid, title, artist, dist, leaf_id, node_d2, same_artist_as_query, partner?}],
  low_similarity: bool,            # 10위 거리 > τ_far
  source: "graph" | "exact",        # 사전 계산 그래프 / 정확 kNN 폴백
  rules: {tau_dup, artist_cap, tau_far, length_range_s}, bundle: "v2.2-pca16" }
```
`GET /songs/search?q=&limit=20` → `[{mbid, title, artist, leaf_id, is_korean, n_submissions}]` (제외 곡 미포함, 브릿지·제출본 수 순).
`GET /songs/{mbid}` → 곡 메타 + 좌표(pc1, pc2) + 노드 경로.

## 규칙 (postprocess_rules.json 의 값을 읽는다, 하드코딩 금지)
- 같은 canonical 또는 거리 < τ_dup(1.66) 이웃은 접는다(쿼리 또는 앞선 이웃과).
- 같은 아티스트 ≤ artist_cap(3).
- 길이 규칙 위반·`excluded` 곡·제목 없음 은 후보에서 제외. `flag_instrumental`·`flag_long` 은 후순위(동률 시 뒤로).
- 10위 거리 > τ_far → `low_similarity:true`.

## 알고리즘
1. 후보 = kNN 그래프 k=30 (`work/knn_graph/indices.npy`, v2.1 기준; 제외 곡은 마스킹) → 후처리 → 10개.
2. 10개 미달이면 정확 kNN(행렬곱, 전곡) k=100 으로 폴백 → 후처리.
3. 그래프 recall@30 0.912 (사전 측정) — 폴백·마스킹으로 결과 보정. 그래프 파일이 없으면 전부 정확 kNN.

## 수용 기준
- AC1 브릿지 쿼리 1,000개: p50 ≤ 20ms, **p95 ≤ 50ms** (그래프 경로), 폴백 포함 p99 ≤ 300ms. `tests/bench_neighbors.py` 가 측정·기록.
- AC2 결과에 `excluded` 곡 0, 길이 규칙 위반 0, 같은 아티스트 > 3 인 응답 0, 거리 < τ_dup 인 쌍 0 (1,000 쿼리 전수).
- AC3 브릿지 풀 Hit@10 이 v2.1 기준(0.0540)의 ±5% 안 (그래프 근사·마스킹 영향 확인).
- AC4 텍스트 검색: "아이유", "IU", "coldplay", "밤편지" 각 100ms 이내 응답, 제외 곡 0.
- AC5 서비스 기동 ≤ 60s, 상주 메모리 ≤ 3GB (좌표 424MB + 그래프 795MB + 메타).
- AC6 `pytest tests/test_neighbors.py` 통과 (규칙 단위 테스트: 접힘·상한·길이·마스킹·폴백).

## 비범위
ANN 인덱스(faiss) — 컷 후보. 오디오 업로드 질의 없음(카탈로그 곡만).
