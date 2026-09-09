# 12 트리 탐색 — plan

- `retrieval/tree.py`: tree.json 로드 → 노드 dict; 기동 시 `catalog(leaf_id, excluded, is_bridge, n_submissions)` + coords(pc1, pc2) 로 리프별 집계(size, centroid, 대표곡 후보) → 상위 노드는 리프 합산(centroid 는 가중 평균). 캐시 parquet 로 재기동 즉시.
- 장르 요약: `output/bridge_v2.parquet` gnr 첫 코드 → `GN` 코드표(`scripts/qual_prepare.GN`) 이름. 브릿지 곡만.
- 대표곡: 리프별 브릿지 곡 cnt(labels cnt_a/cnt_b) 상위 → 상위 노드는 자식 대표곡 병합 후 아티스트 중복 제거.
- API 는 `retrieval/api.py` 에 라우터 추가. 곡 → path 는 leaf_id 문자열 분해로 O(1).
- 리스크: 노드 `size` 합 검증이 제외 반영 후 깨지면 집계 버그 → 테스트로 고정.
