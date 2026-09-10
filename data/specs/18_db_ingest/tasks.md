# 18 적재 파이프라인 — tasks

T2 는 스펙 17 T1(Postgres 자원 상향) 대기다. **인덱스 빌드가 반나절 걸리므로 그전에 적재를 시작하지 않는다.**

| # | 작업 | 완료 조건 | 상태 |
|---|---|---|---|
| T1 | DDL 초안 (`music` `genre` `music_genre`). 마이그레이션 도구 결정 전이라 커밋하지 않고 스펙에만 둔다 | 컬럼·타입이 스펙 표와 1:1. `location` 이 `vector(16)` | ⬜ |
| T2 | Postgres 자원 상향 확인 | 스펙 17 T1 완료 기록 | ⛔ 대기 |
| T3 | `scripts/db_export.py` — parquet → CSV 4개(music·genre·music_genre·neo4j) | 662만 행 CSV 생성. 표본 100행이 원본과 비트 일치 | ⬜ |
| T4 | `genre` 적재 | 행 수 29, `name` UNIQUE (AC5) | ⬜ |
| T5 | `music` 적재 (인덱스 없이 COPY) | 행 수 == `manifest.songs`, 전 행 소문자 UUID (AC1) | ⬜ |
| T6 | 좌표 불변성 검사 | 무작위 1,000행이 `coords_v2.parquet` 과 비트 일치 (AC2) | ⬜ |
| T7 | `bpm` 검사 | 표본 1,000행이 `v2_feats.rhythm.bpm` 과 상대오차 0 (AC3). NULL 733,146곡 기록 | ⬜ |
| T8 | 비워 둔 세 필드 검사 | `release_year`·`album`·`youtube_url` 전 행 NULL (AC4) | ⬜ |
| T9 | `music_genre` 적재 | 행 수 67,472, 장르 없는 곡 6,556,927 확인 (AC5·AC6) | ⬜ |
| T10 | HNSW 인덱스 생성 | 빌드 완료. 소요 시간·`pg_relation_size` 기록 (AC8) | ⬜ |
| T11 | Neo4j 적재 | `(:Music)` 노드 수 == `music` 행 수, `genres` 일치 (AC7) | ⬜ |
| T12 | `tests/test_db_ingest.py` | 스키마·매핑 검사 통과, 실 DB 없으면 skip (AC9) | ⬜ |
| T13 | `output/db_ingest_bench.json` | 적재 시간·인덱스 크기·디스크 기록 (AC8) | ⬜ |

## 순서 메모
- T1·T3·T12 는 T2 없이도 한다. DDL 검토와 CSV 생성, 테스트 작성은 자원과 무관하다.
- T4~T11 은 T2 이후.
- T10 을 T9 보다 뒤에 둔 이유는 적재 중 인덱스 유지 비용을 피하기 위해서다.
- T11 은 Postgres 적재가 끝난 뒤. Neo4j 는 `music_genre` 를 배열로 펼쳐 담는다.

## 시작 전 확인
- D11 이 `DECISIONS.md` 에 있는가. `location` = PCA-16, 세 필드 1차 NULL, 이름은 `music` 으로 통일.
- 열린 질문 Q2(마이그레이션 도구)가 열려 있으면 DDL 을 커밋하지 않는다.
- 열린 질문 Q3(멜론 코드표)가 열려 있으면 `genre.name` 에 코드 문자열이 들어간다.
- 열린 질문 Q7(특징 2파트)이 열려 있으면 `bpm` 이 733,146곡에서 NULL 이다.
