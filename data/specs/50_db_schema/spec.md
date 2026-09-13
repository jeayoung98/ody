# 50 DB 스키마·마이그레이션 (data 소유 테이블) — spec

상태 ✅ 종결(2026-09-11) · Jira **S15P21A405-90** · 스키마는 Backend 가 소유한다

## 목적
data 트랙이 만드는 산출물(곡·아티스트·좌표·지도 계층)을 PostgreSQL 에 서빙 가능한 형태로 두고, 스키마 변경을 재현 가능하게 관리한다.

## 종결 (2026-09-11)

**이 스펙은 더 진행하지 않는다. Backend 가 스키마를 만들었고 data 는 데이터만 넣는다.**

2026-09-10 실사에서 `ody` DB 에 `music`·`genre`·`music_genre` 가 이미 있었다(pgvector 0.7.0, `location vector(16)`). 그래서 data 가 DDL 을 쓸 일이 없어졌다.

| 이 스펙이 결정 대기였던 것 | 어떻게 끝났나 |
|---|---|
| Q1 `track_vector` 차원 | **D7** PCA-16 |
| Q2 마이그레이션 도구 | **종결.** Backend 가 스키마를 소유하므로 data 는 도구를 고르지 않는다 |
| Q3 소유권 경계 | data 는 `music`·`genre`·`music_genre` 에 **데이터만** 넣는다. 테이블 정의는 BE |
| Q4 Vector DB 도입 | **D9** pgvector |

실제 스키마와 적재 결과는 스펙 18, 좌표 인덱스는 스펙 17, 지도 레이어 인덱스는 스펙 16 에 있다.

⚠️ 이름 표기 하나: 이 스펙은 `track` 으로 적었지만 실제 테이블은 **`music`** 이다(D11). 아래 원문은 기록으로 남긴다.

---

## 원문 (2026-09-11 종결 전)

## 현재 상태 (docs/infra/DATABASE.md, 2026-09-08 기준)
- PostgreSQL 17.11 이 transactional Source of Truth, Neo4j 5.26.30 은 graph/read projection.
- **Backend 에 domain Entity·schema·migration 이 아직 없다.** Flyway/Liquibase 도입 여부는 domain 도입 전에 결정하기로 돼 있다.
- 두 DB 는 app-node `ody-internal` 네트워크에서만 접근. 운영 credential 은 서버에만.
- Backend 코드는 `com.ssafy.backend.{controller,config,dto,common}` 수준이고 Entity 계층이 없다.

즉 이 스펙은 **"스키마를 만든다" 이전에 "도구를 정한다"** 가 먼저다.

## 팀 결정이 필요한 것 ⛔
| # | 질문 | 상충하는 근거 |
|---|---|---|
| Q1 | `track_vector` 차원 | Jira S15P21A405-35 설명은 **dim 64**, 실제 아티팩트는 **PCA-16**(`manifest.k=16`). 어느 쪽이 맞는지 팀 확인 없이 한쪽을 고르지 않는다 |
| Q2 | 마이그레이션 도구 | Flyway / Liquibase / 수동 SQL. DATABASE.md 는 미결정으로 둠 |
| Q3 | 소유권 경계 | 사용자·플레이리스트 테이블은 BE1(Jira S15P21A405-89). data 는 곡·좌표·지도 계층만 소유 |
| ~~Q4~~ | ~~Vector DB 도입 여부~~ | **종결 2026-09-10 → D9: pgvector.** `track_vector` 테이블은 스펙 `17_pgvector_serving` 이 정의한다. 이 스펙은 `track`·`artist`·`track_artist` 만 소유한다 |

Q1 은 D7(PCA-16), Q4 는 D9(pgvector) 로 종결됐다. 남은 Q2·Q3 가 정해지기 전에는 DDL 을 확정하지 않는다. 결정되면 `specs/DECISIONS.md` 에 새 번호로 기록하고 이 스펙을 갱신한다.

## 산출물 (Q2 확정 후)

⚠️ **D11 로 이름이 바뀌었다(2026-09-10).** `track` → **`music`**. 좌표·장르 테이블 정의는
스펙 `18_db_ingest` 가 소유한다. 이 스펙은 아티스트 정규화와 지도 계층만 갖는다.

```
music            스펙 18 소유. mbid PK, title, artist, duration, bpm, location vector(16),
                 release_year·album·youtube_url (1차 NULL), flag_* ...
genre            스펙 18 소유
music_genre      스펙 18 소유
artist           artist_id PK, name_raw, name_norm            ← 이 스펙
music_artist     mbid, artist_id  (다대다)                     ← 이 스펙. 옛 track_artist
track_position   스펙 16 참조
map_layer        스펙 16 참조
```

`music.artist` 는 표시용 원문(`artist_raw`)이고, 정규화된 아티스트 실체는 `artist` 테이블이다. 둘은 다르다.

컬럼은 **계약(스펙 00)의 카탈로그 정의와 1:1** 이다. 계약에 없는 컬럼을 DB 에서 새로 만들지 않는다.

## 규칙
- 좌표 컬럼은 `real`(float32). 아티팩트 dtype 과 같아야 값이 변하지 않는다(Jira 35 좌표 불변성 게이트).
- `track.mbid` 는 소문자 UUID. CHECK 제약으로 강제한다.
- **운영 DB 초기화·삭제 금지**(팀 `AGENTS.md` §8). 마이그레이션은 앞으로만 간다. 롤백은 되돌리는 마이그레이션을 새로 추가하는 방식이다.
- 시크릿을 스키마 파일·문서에 남기지 않는다.
- 6.6M 행 적재는 인덱스를 만들기 **전**에 한다.

## 수용 기준
- AC1 Q1~Q4 의 답이 `specs/DECISIONS.md` 에 새 번호로 기록돼 있다. 기록 없이 DDL 을 커밋하지 않는다.
- AC2 마이그레이션 도구 결정에 따라 첫 마이그레이션 파일이 저장소에 있고, 빈 DB 에서 실행하면 위 5개 테이블이 생성된다.
- AC3 생성된 컬럼 이름·타입이 계약(스펙 00)의 카탈로그 정의, 스펙 16 의 테이블 정의와 1:1로 일치한다. 자동 검사 `tests/test_db_schema.py::test_columns_match_contract`.
- AC4 `track.mbid` UNIQUE + 소문자 UUID CHECK 가 걸려 있고, 위반 행 삽입이 거부된다.
- AC5 좌표 왕복 검사 — 아티팩트에서 적재한 뒤 다시 읽은 `pc1`,`pc2` 가 원본과 bit 단위로 같다(`test_coord_roundtrip`).
- AC6 6.6M 행 적재 시간·인덱스 크기·디스크 사용량을 `output/db_load_bench.json` 에 기록한다. 적재 전에 app-node `/data` 여유 디스크를 확인한 수치도 같이 적는다.
- AC7 각 마이그레이션에 되돌리는 절차(역 마이그레이션 또는 재생성 순서)가 문서화돼 있다.
- AC8 `pytest tests/test_db_schema.py` 통과 (스키마 파일 파싱 기준. 실 DB 없으면 skip).

## 비범위
- 사용자·인증·플레이리스트 테이블 (Jira S15P21A405-89, BE1 준서).
- Neo4j 투영 (HANDOVER_TEAM §5: 1차 미사용).
- Vector DB 도입 (Q4 결정 전).
- Backend 의 Entity/Repository 코드. 이 스펙은 스키마와 적재까지다.
