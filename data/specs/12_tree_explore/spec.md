# 12 트리 탐색 — spec

상태 ⬜ · 목표일 09-09

## 목적
깊이 0(전체) → 6(리프 4,096) 사분할 트리를 단계별로 내려가며 지도를 둘러볼 수 있게 한다. 각 노드에서 곡 수, 위치, 대표곡, 장르 요약을 준다.

## 입력·출력
`GET /nodes/{node_id}` (예 `root.2.0`)
```
{ id, depth, size (excluded 제외 곡 수), size_all, children: [{id, size, centroid_2d:[pc1,pc2], top_genre?}],
  centroid_2d, representatives: [{mbid, title, artist, is_bridge, n_submissions}] (≤5),
  genre_summary: [{genre, share}] (브릿지 곡 기준, 상위 5), leaf: bool, bundle }
```
`GET /nodes/{node_id}/songs?limit=50&offset=0&order=popular` → 노드 곡 목록(제외 곡 미포함).
`GET /songs/{mbid}` 응답의 `path: ["root","root.2","root.2.0",...]` 로 곡 → 노드 연결.

## 규칙
- `size` 는 `excluded=false` 이고 길이 규칙 통과 곡만. `size_all` 은 트리 원본(tree.json) 값.
- 대표곡 = 노드 안 브릿지 곡을 플레이리스트 등장 수(labels 의 cnt) 순, 없으면 `n_submissions` 순. 아티스트 중복 없이.
- 중심은 노드 곡 좌표 평균(pc1, pc2). 기동 시 5,461 노드 전부 사전 계산(≈ 1분) 후 캐시 `work/tree_stats.parquet`.

## 수용 기준
- AC1 5,461 노드 전부 응답 200, p95 ≤ 20ms (사전 계산 조회).
- AC2 자식 `size` 합 == 부모 `size` (제외 반영 후에도 성립), 리프 4,096 개.
- AC3 `/nodes/root` 의 `genre_summary` 가 `output/qual_check.md` 자동 관찰 표(장르 × depth-1)와 방향 일치(록/메탈(해외) root.2 최다 등).
- AC4 `pytest tests/test_tree.py` 통과.

## 비범위
2D 좌표 전곡 전송(→ 프론트는 노드 요약·표본만), 노드 이름 짓기(장르 요약으로 대체).
