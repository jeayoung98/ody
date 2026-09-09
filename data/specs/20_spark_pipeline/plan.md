# 20 Spark 파이프라인 — plan

## 원본 적재 (S0) 두 경로
- **A(기본)**: 기존 스트리밍 추출기(`scripts/extract_v2_features.py`, zstandard+tarfile)를 파트별 병렬로 돌려 로컬 Parquet → `hdfs dfs -put`. 이미 검증된 코드, 파트당 ≈ 5분(4-way). 30파트 ≈ 3시간.
- **B(Spark 네이티브, 09-12 시도)**: `spark.read.format("binaryFile")` 로 tar.zst 를 통째로 읽으면 파일당 20GB 단일 태스크가 되어 비효율 → 파트를 사전에 `zstd -d | tar` 로 JSON 디렉터리로 풀어 HDFS 에 두고 `spark.read.json`(스키마 고정, 필요한 270 경로만 select). 디스크 2~3TB 필요 → 클러스터 용량 확인 후 결정. 안 되면 A 로 확정(컷 1번).

## 전처리 (S2) — pandas UDF 대신 순수 Spark SQL 컬럼식
- skew: `log1p(x)` / `sign(x)*log1p(abs(x))` per feature (feature_list.skew_transform).
- M1: `lossless==false` 행에만 `x − delta_f`.
- impute: `coalesce(x, impute_median_f)`.
- scaler: `(x − center_f)/scale_f`, clip ±winsorize_clip.
- 270 컬럼식을 코드 생성(Python 이 SQL 표현식 생성). float64 계산 후 float32 캐스트 — 기존 파이프라인의 캐스트 시점과 맞춘다(패리티 오차 주원인).

## PCA (S3)
`pc_k = Σ_f (x_f − mean_f) · comp[k,f]` — 270×16 곱을 컬럼식 16개로. 또는 `VectorAssembler` + `Matrix` 곱(mllib 없이 numpy 상수 브로드캐스트한 pandas UDF). 성능은 둘 다 충분(7.4M × 4,320 FLOP).

## 트리 배정 (S4)
노드별 `axes(2×16), median(2), mean(16)`: 깊이 6 반복 — 각 단계에서 현재 노드 id 로 파라미터 조인 후 `q = ((x−mean)·axis0 > med0)*1 + ((x−mean)·axis1 > med1)*2` → `node_id || '.' || q`. 1,365 내부 노드 파라미터를 브로드캐스트 맵으로.

## 카탈로그 (S5)
`pipeline/exclusion_apply.py` 의 규칙을 Spark SQL 로 1:1 이식. R5/R6 의 그룹 대표 선정은 window 함수(`row_number() over (partition by key order by ...)`). 거리 보호 4.0 은 대표와의 좌표 거리 — 그룹 내 self-join. 규칙 해시는 JSON 파일 sha256.

## 패리티 테스트 (`tests/test_spark_parity.py`)
로컬 `pyspark` (local[8]) 로 표본 10만 행 실행 → numpy 기준 파이프라인 결과와 비교. 전곡은 클러스터 결과 Parquet 를 내려받아 요약 통계(최대 오차·불일치 수)만 검사.

## 자원 가정
클러스터 사양 미확인 → 09-10 오전 확인. 로컬 pyspark 로 개발·패리티, 클러스터는 S0 와 전곡 실행.

## 리스크
- pyspark 로컬 설치·JDK 필요(venv 밖). 09-10 첫 1시간 환경.
- winsorize/skew 경계 부동소수 차이 → float64 통일.
- R6 그룹 로직이 pandas 특유(정렬 안정성) → 대표 선정 규칙을 명시적 정렬키로.
