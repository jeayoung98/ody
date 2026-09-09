# 20 Spark 파이프라인 — tasks (09-10 ~ 09-12)

D8(프로젝트 요건): **T2 와 클러스터 제출은 컷 대상이 아니다.** 로컬 `local[*]` 결과만으로 T3~T7 을 완료로 표시하지 않는다(AC0).

| # | 작업 | 완료 조건 | 상태 |
|---|---|---|---|
| T1 | 환경: JDK·pyspark 로컬, 클러스터 접속·HDFS 경로·자원 확인, `spark/README.md` 초안 | `spark-submit --version`, `hdfs dfs -ls` 성공 | ⬜ |
| T2 | 기존 v2 특징 Parquet(7.4M × 270 + 메타) HDFS 업로드 (`raw_features_extracted/`) | `hdfs dfs -count` 행 수 7,404,506, `hdfs dfs -du -h` 기록 (AC5) | ⬜ |
| T2b | S2·S3 을 `--master yarn` 으로 제출해 SUCCEEDED | `output/spark_run_S2_*.json`, `spark_run_S3_*.json` 에 YARN application id·입출력 HDFS 경로·행 수 (AC0) | ⬜ |
| T3 | `spark/jobs/preprocess.py` (S2, SQL 컬럼식 생성) | `test_spark_parity.py::test_preprocess_sample` (< 1e-4) | ⬜ |
| T4 | `spark/jobs/pca.py` (S3) | `test_pca_sample` + 전곡 요약 | ⬜ |
| T5 | `spark/jobs/tree_assign.py` (S4) | 리프 일치 100% | ⬜ |
| T6 | `spark/jobs/catalog_rules.py` (S5, R1~R9 + 길이 v4 + flag_instrumental) | 규칙별 적중 수 == v2.2 `exclusion_report` | ⬜ |
| T7 | `spark/jobs/artifact_export.py` (S6) + manifest 해시 | `check_contract.py --strict --prev` 통과 | ⬜ |
| T8 | S0 원본 적재 잡 (경로 A 기본, B 시도) 1파트 완주 | 표본 1만 행 값 일치 | ⬜ |
| T9 | 30파트 적재 가동 (배포 후 완주 허용) | 진행 로그 | ⬜ |
