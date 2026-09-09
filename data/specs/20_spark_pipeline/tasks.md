# 20 Spark 파이프라인 — tasks (09-10 ~ 09-12)

| # | 작업 | 완료 조건 | 상태 |
|---|---|---|---|
| T1 | 환경: JDK·pyspark 로컬, 클러스터 접속·HDFS 경로·자원 확인, `spark/README.md` 초안 | `spark-submit --version`, `hdfs dfs -ls` 성공 | ⬜ |
| T2 | 기존 v2 특징 Parquet(7.4M × 270 + 메타) HDFS 업로드 (`raw_features_extracted/`) | 행 수 7,404,506 | ⬜ |
| T3 | `spark/jobs/preprocess.py` (S2, SQL 컬럼식 생성) | `test_spark_parity.py::test_preprocess_sample` (< 1e-4) | ⬜ |
| T4 | `spark/jobs/pca.py` (S3) | `test_pca_sample` + 전곡 요약 | ⬜ |
| T5 | `spark/jobs/tree_assign.py` (S4) | 리프 일치 100% | ⬜ |
| T6 | `spark/jobs/catalog_rules.py` (S5, R1~R9 + 길이 v4 + flag_instrumental) | 규칙별 적중 수 == v2.2 `exclusion_report` | ⬜ |
| T7 | `spark/jobs/artifact_export.py` (S6) + manifest 해시 | `check_contract.py --strict --prev` 통과 | ⬜ |
| T8 | S0 원본 적재 잡 (경로 A 기본, B 시도) 1파트 완주 | 표본 1만 행 값 일치 | ⬜ |
| T9 | 30파트 적재 가동 (배포 후 완주 허용) | 진행 로그 | ⬜ |
