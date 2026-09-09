# 30 평가 잡 — spec

상태 ⬜ · 목표일 09-12 (컷 후보 4번)

## 목적
아티팩트 버전이 바뀔 때마다 같은 지표를 자동으로 계산해 `output/eval/<bundle_version>.md|json` 으로 남긴다. 사람 청취 채점(CSV)은 같은 리포트에 합친다.

## 지표 (전부 기존 스크립트 재사용)
| 지표 | 출처 스크립트 | 기준값(v2.1) |
|---|---|---|
| 멜론 공통 풀 AUC(v1 대비 Δ, CI) | `validate_v2_gate2.py` | Δ+0.0466 [+0.037, +0.056] |
| 브릿지 풀 Hit@10 (후처리 후) | `postprocess_ab.py` | 0.0540 |
| MLHD 보정 AUC | `validate_v2_mlhd.py` | 0.607 |
| depth-1 제외 편중 최대 | `exclusion_report` | 1.17× |
| ANN/그래프 recall@10·@30 vs 정확 | `knn_graph_build.py` recall_check | 0.920 / 0.912 |
| 이웃 API p50/p95, 여정 p95 | `bench_*.py` | (1차 측정) |
| 사람 청취: 쿼리 평균 점수, 결함 빈도, 여정 판정 | `qual_eval_summary.py` | (채점 대기) |

## 수용 기준
- AC1 `python scripts/eval_all.py serving/v2.2-pca16` 한 번으로 위 표가 채워진 md/json 생성, 30분 이내.
- AC2 기준값 대비 변화율 표기, Hit@10 −5% 초과 하락 시 리포트 상단에 경고(자동 차단은 아님 — 승격은 사람).
- AC3 CI 에서 실행 가능(환경변수로 데이터 경로).

## 비범위
새 지표 설계, 게이트 재등록(→ 별도 결정).
