# 14 축 라벨 — tasks (Jira S15P21A405-38)

선행: 스펙 13(정규화 태그). 13 이 끝나기 전에 T2 를 시작하지 않는다.

| # | 작업 | 완료 조건 | 상태 |
|---|---|---|---|
| T1 | 극단 집합 추출 (PC1~PC4, 상·하위 1%) | `work/axis_extremes.parquet`, 집합 크기 로그 | ⬜ |
| T2 | 태그 log-odds + 멜론 버킷 보조 근거 | `output/axis_labels_<version>.json` 의 `evidence` 블록 (AC1) | ⬜ |
| T3 | 대표곡 5곡 × 8극단 + YouTube 검색 URL | 같은 JSON 의 `*_songs`, 아티스트 중복 0 | ⬜ |
| T4 | 재현성 확인 | 같은 seed 2회 실행 산출물 sha256 일치 (AC2) | ⬜ |
| T5 | 검수 양식 배포 + 3명 검수 | `output/axis_label_review.csv` 12행(4축 × 3명) (AC6) | ⬜ |
| T6 | 집계 → `aux/axis_labels.json` | labeled 축 ≥ 3 (AC3), unlabeled 는 `label: null` (AC4) | ⬜ |
| T7 | 계약 검사 (aux 있음/없음 양쪽) | `check_contract.py` FAIL 0 (AC5) | ⬜ |
| T8 | 스키마·규칙 테스트 | `pytest tests/test_axis_labels.py` (AC7) | ⬜ |
