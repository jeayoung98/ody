# 11 여정 — plan

## 구조
```
retrieval/journey.py
  linear(a, b, n)            # 지점별 전곡 스캔: sq − 2X·p (N×16 행렬-벡터, ≈ 60~100ms/지점) → n=10 ≈ 1s. 느리면 faiss IVF(4,096 k-means 중심 재사용) 로 지점당 < 5ms
  axis_dp(a, b, n)           # journey_smooth.viterbi2 이식. 통로 후보 계산(p, r 전곡 ≈ 0.3s) + 층 M=400 2차 Viterbi ≈ 1~3s
  polyline(a, b, n)          # 리프 중심 그래프 A*(4,096 노드, ms) → 폴리라인 → linear 와 같은 지점 스캔
  choose_n(dist)             # D3
```
- 후보 마스크·규칙은 `retrieval/postprocess.py` 와 공유. 아티스트 상한은 여정용 2 (규칙 파일에 `journey.artist_cap` 추가 — 후처리 규칙 파일 minor 갱신, basis 기록).
- 리프 중심·k-means 중심은 `work/qual/leaf_centroids.parquet` / kNN 그래프 빌드의 k-means 를 아티팩트 보조 파일 `serving/<v>/aux/` 로 옮긴다(계약 v1 선택 파일, 검사기 WARN 만).

## 성능
linear 의 병목 = 지점 10개 × 전곡 스캔. 첫 배포는 numpy 로 두고 벤치가 2s 를 넘으면 faiss IVF4096 (nprobe 16) 로 교체. faiss 미설치 환경 대비 numpy 경로 유지.

## 검증 데이터
`work/qual/journeys.json`(linear 기준값), `journeys_smooth.json`(axis 기준값) → `tests/test_journey.py` 골든.

## 리스크
- 이식 중 규칙 미세 차이(아티스트 ≤2 vs 3, 길이 결측 처리)로 골든 불일치 → 규칙 값을 파일에서 읽고 골든 생성 조건을 테스트에 명시.
- polyline 은 시간 초과 시 컷(컷 순서 3번 뒤).
