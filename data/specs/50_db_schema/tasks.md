# 50 DB 스키마·마이그레이션 — tasks (Jira S15P21A405-90)

T1 이 끝나기 전에 T3 이후를 시작하지 않는다(AC1).

| # | 작업 | 완료 조건 | 상태 |
|---|---|---|---|
| T1 | Q1~Q4 팀 확인 (벡터 차원·도구·소유권·Vector DB) | `specs/DECISIONS.md` 새 번호 4건 (AC1) | ⛔ 대기 |
| T2 | 마이그레이션 도구 도입 (BE1 협의) | 첫 마이그레이션 파일 커밋, 빈 DB 에서 실행 성공 (AC2) | ⬜ |
| T3 | data 소유 5개 테이블 DDL | `test_db_schema.py::test_columns_match_contract` (AC3) | ⬜ |
| T4 | 제약 (mbid UNIQUE + 소문자 UUID CHECK) | `test_mbid_constraint` 위반 삽입 거부 (AC4) | ⬜ |
| T5 | CSV 내보내기 + COPY 적재 스크립트 | `pipeline/export_csv.py`, 로컬 DB 적재 성공 | ⬜ |
| T6 | 좌표 왕복 검사 | `test_coord_roundtrip` bit 일치 (AC5) | ⬜ |
| T7 | 디스크 여유 확인 + 적재 벤치 | `output/db_load_bench.json` (AC6) | ⬜ |
| T8 | 롤백 절차 문서화 | `docs/db_migration_rollback.md` (AC7) | ⬜ |
