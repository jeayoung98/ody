# 00 서빙 아티팩트 계약 — plan

## 검사기 설계 (`tests/check_contract.py`)
- 입력: 번들 디렉터리, `--strict`(v2.2+ 해시 필수), `--prev <dir>`(minor 규칙: 좌표·트리·모델 해시 동일 확인), `--json`(결과 JSON 출력).
- 단계: 파일 존재 → manifest 키 → parquet 스키마(pyarrow schema 만, 빠름) → 행 수(metadata) → mbid 유일성·finite(pyarrow compute, 전량) → node_paths 와 coords mbid 집합 동일(정렬 비교) → tree/split_axes 정합 → model_bundle shape → feature_list 정합 → postprocess_rules 키 → 해시(strict).
- 출력: `OK` / `WARN` / `FAIL` 항목 목록, exit 0(FAIL 없음) / 1.
- 성능: coords 586MB 읽기 ≈ 5~10s, unique ≈ 5s, node_paths 141MB ≈ 3s → 총 ≤ 30s.

## 포인터 파일 `serving/CURRENT.json`
```json
{"bundle": "v2.1-pca16", "switched_at": "2026-09-07T..", "by": "재영", "reason": "초기"}
```
서비스 기동 시 읽는다. 롤백 = 이 파일만 이전 값으로.

## 해시 생성 (`scripts/artifact_finalize.py`, 09-08 작성)
- 번들 내 모든 파일 sha256 → `manifest.files`, 카탈로그 → `manifest.catalog_sha256`, `contract_version="v1"`, `created_at`.
- v2.2 생성기(`pipeline/exclusion_apply.py` apply 경로)가 마지막에 호출.

## 의존
pyarrow 25, numpy 2.5, pandas 3.0 (venv 에 있음). pytest 9 (설치함).

## 리스크
- `mbid` 유일성 검사 메모리: 6.6M 문자열 ≈ 400MB → pyarrow `pc.unique` 로 처리, pandas 변환 피함.
- v2.1 은 해시가 없어 strict 불가 → v2.2 부터 strict. CURRENT 가 v2.1 을 가리키는 동안 테스트는 non-strict.
