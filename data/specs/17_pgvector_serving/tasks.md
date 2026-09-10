# 17 pgvector 좌표 서빙 — tasks

T1 은 인프라 합의 대기다. **T2 이후는 T1 이 끝나기 전에 시작하지 않는다.** 662만 행 인덱스 빌드가 반나절 걸린다.

| # | 작업 | 완료 조건 | 상태 |
|---|---|---|---|
| T1 | Postgres 컨테이너 자원 상향 합의 (메모리 4~6 GB, `maintenance_work_mem` 2 GB, CPU 2 이상) | 인프라 담당 승인 기록. `docs/infra/DATABASE.md` 갱신 | ⛔ 대기 |
| T2 | `scripts/pgvector_export.py` — `coords_v2.parquet` → CSV | 662만 행 CSV 생성, 표본 100행이 parquet 값과 비트 일치 | ⬜ |
| T3 | DDL: `track_vector` 테이블 (인덱스 없이) | `\d track_vector` 가 스펙과 일치. 차원 16, L2 | ⬜ |
| T4 | COPY 적재 | 행 수 == `manifest.songs`, 전 행 `bundle` 동일 (AC1) | ⬜ |
| T5 | 좌표 불변성 확인 | 무작위 1,000행이 parquet 과 비트 일치 (AC7) | ⬜ |
| T6 | HNSW 인덱스 생성 | 빌드 완료. 소요 시간과 `pg_relation_size` 기록 (AC5) | ⬜ |
| T7 | `tests/bench_pgvector.py` — 재현율·지연 측정 | recall@10 평균 ≥ 0.99 (AC2), p95 ≤ 50ms (AC3) → `output/pgvector_recall_<번들>.json` | ⬜ |
| T8 | 후처리 결합 확인 | pgvector top-50 → `apply_rules` → top-10 에 제외 곡 0, 길이 위반 0 (AC4) | ⬜ |
| T9 | Backend 연동 문서 | 질의 계약, **서브쿼리 금지**, 필터 제약이 적혀 있다 (AC6) | ⬜ |

## 순서 메모
- T2·T3 는 T1 없이도 할 수 있다. CSV 생성과 DDL 검토는 자원과 무관하다.
- T4~T6 은 T1 이후.
- T7 은 T6 이후. 인덱스 없이 재면 순차 스캔 시간이라 의미가 없다.
- T9 는 언제든. 오히려 빨리 써서 Backend 가 서브쿼리 형태로 짜는 것을 막는 게 낫다.

## 이 스펙을 시작하기 전에 확인할 것
- D9 가 `DECISIONS.md` 에 있고 Q6 이 종결됐는가.
- 스펙 50 의 `track` 테이블이 먼저 있어야 `REFERENCES track(mbid)` 가 성립한다. 없으면 외래키 없이 만들고 나중에 붙인다.
