# 50 DB 스키마·마이그레이션 — plan

## 진행 순서
1. **Q1~Q4 를 팀에 올린다** (스펙 spec.md 참조). 답이 오기 전 단계 2 로 가지 않는다.
2. 마이그레이션 도구 결정을 `specs/DECISIONS.md` 에 기록.
3. DDL 작성 → 로컬 PostgreSQL(`infra/local`, `scripts/local/dev.py up`)에서 적용.
4. 스펙 16 의 parquet 을 CSV 로 내보내 `COPY` 적재.
5. 인덱스 생성 → 벤치 기록.

## Q1 (dim 64 대 PCA-16) 을 푸는 방법
아티팩트 `manifest.k` 는 16 이고 `coords_v2.parquet` 은 `pc1..pc16` 이다. Jira 35 설명의 "dim 64" 는 기획 초기 값으로 보이나 **추측하지 않는다**. 확인 경로:
- 아티팩트가 사실의 출처다(스펙 00 이 모든 트랙의 인터페이스).
- 64차원이 필요하다면 재학습이 필요하고, 이는 major 버전 + 게이트 재등록이다(규칙 3). 1차 기간에 불가능하다.
- 따라서 제안은 **16 으로 맞추고 Jira 35 설명을 갱신**하는 것이며, 최종 결정은 팀이 한다.

## 마이그레이션 도구 (판단 재료)
Backend 는 Spring Boot 다. Flyway 는 Spring Boot 와 통합이 단순하고 SQL 파일 그대로 쓴다. Liquibase 는 XML/YAML 변경 로그로 DB 독립성이 높다. 이 프로젝트는 PostgreSQL 단일이고 DDL 이 단순하므로 **Flyway 쪽이 비용이 낮다**. 다만 이 선택은 Backend 전체에 영향을 주므로 BE1(준서)과 함께 정한다.

위치 규약(Flyway 를 택할 경우): `backend/src/main/resources/db/migration/V<n>__<설명>.sql`. data 소유 테이블은 파일 이름에 `data_` 접두를 둬 소유를 표시한다.

## 적재 경로
```bash
# 1) 스펙 16 산출물 → CSV
python pipeline/export_csv.py --in work/map_layer --out work/db_csv
# 2) 적재 (인덱스 생성 전)
psql -c "\copy track FROM 'work/db_csv/track.csv' WITH (FORMAT csv, HEADER true)"
psql -c "\copy track_position FROM 'work/db_csv/track_position.csv' WITH (FORMAT csv, HEADER true)"
# 3) 인덱스
psql -f pipeline/indexes.sql
```
운영 적용은 `ops/` 절차를 따르고, 실행 전 백업(`ops/backup/postgres.sh`)을 확인한다.

## 용량 추정 (측정으로 대체할 것)
`track_position` 6.6M 행 × (uuid 16B + leaf_id ~20B + real 2개 8B + node 문자열) ≈ 수백 MB + 인덱스. app-node 는 PostgreSQL·Neo4j·Backend 가 15GiB 를 나눠 쓴다. **추정으로 진행하지 않고 AC6 에서 실측**한 뒤 적재한다. 여유가 부족하면 브릿지 곡 우선 부분 적재를 별도 결정으로 올린다.

## 리스크
- **Q1 을 임의로 고르는 것** — 64 를 골라 재학습하면 좌표가 바뀌고 지금까지의 검증이 전부 무효가 된다. 그래서 결정 전 DDL 금지가 AC1 이다.
- **운영 DB 사고** — 초기화·DROP 은 팀 금지 목록. 마이그레이션은 앞으로만.
- **소유권 충돌** — BE1 의 마이그레이션과 번호가 겹치면 적용 순서가 꼬인다. 번호 대역을 나누거나 타임스탬프 방식을 쓴다.
