# 10 이웃 검색 — plan

## 구조
```
retrieval/
  artifact.py     # CURRENT.json → 번들 로드: coords(float32 N×16), mbid→row(pandas Index), catalog 필요 컬럼, kNN 그래프(memmap), 규칙
  postprocess.py  # scripts/postprocess_ab.apply_rules 를 옮기고 flag 후순위 추가 (같은 로직, 테스트 동반)
  neighbors.py    # graph_candidates(row) → apply → fallback exact_knn(row, k=100)
  search.py       # DuckDB: catalog 의 (mbid, title_raw, artist_raw, is_bridge, n_submissions, excluded) → FTS 인덱스 (기동 시 1회 빌드 ≈ 20s, 파일 캐시 work/search.duckdb)
  api.py          # FastAPI 앱, pydantic 스키마, /health
```
- 좌표·그래프는 `np.load(mmap_mode="r")` 로 메모리 상주 최소화. 정확 kNN 폴백은 블록 행렬곱(BLOCK 250k) ≈ 150~250ms.
- 제외 마스크: `excluded | ~length_ok | title=="" ` 를 bool N 배열로 기동 시 계산.

## API 계약 (BE 게이트웨이용)
- 모든 응답에 `bundle`(버전)과 `rules` 포함. 오류: 404(mbid 없음), 422(파라미터), 503(번들 로드 중).
- OpenAPI 는 `/openapi.json` 자동. CORS 는 게이트웨이 뒤라 비활성.

## 성능 예산
그래프 조회 O(1) + 후처리 30개 → < 5ms. FastAPI 오버헤드 ~1ms. p95 50ms 는 여유. 폴백 비율 예상 < 5%.

## 벤치 (`tests/bench_neighbors.py`)
브릿지 1,000 쿼리(seed 42) → 지연 분포·폴백 비율·규칙 위반 0 확인·Hit@10 → `output/bench_neighbors.json`.

## 리스크
- 그래프가 v2.1 행 순서 기준: v2.2 도 같은 coords 행 순서(minor 규칙)이므로 재사용 가능. **major 변경 시 그래프 재구축 필수**(92분) — artifact.py 가 manifest 의 coords 해시와 그래프 meta 를 대조해 불일치 시 그래프 비활성.
- DuckDB FTS 한글 토크나이즈: 기본 토크나이저는 공백 분리 → 부분 일치는 `LIKE` 폴백 병행.
