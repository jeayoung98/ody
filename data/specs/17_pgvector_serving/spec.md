# 17 pgvector 좌표 서빙 — spec

상태 ⬜ · Jira **S15P21A405-117** · 결정 **D9**(Vector DB = pgvector) · 목표일 미정

## 목적
곡 좌표(PCA-16)를 PostgreSQL 에 두고 Backend 가 직접 유사도 검색을 할 수 있게 한다.
**이것이 유일한 이웃 검색 경로다**(D12). 질의는 Backend(Spring)가 직접 던진다. 예전 numpy 서빙 경로는 삭제했다.

## 왜 pgvector 인가 (D9)
2026-09-10 에 app-node 실물에서 Neo4j 와 pgvector 를 둘 다 측정했다. 근거는 `output/pgvector_bench_2026-09-10.json`.

| | 기존 numpy | pgvector HNSW | Neo4j |
|---|---|---|---|
| 이웃 조회 | p95 1.8 ms | 2.24 ms | warm 2.9 ms / cold 40 ms |
| 재현율 | recall@30 0.912 (그래프) | **recall@10 0.9995** | 해당 없음(정확 저장) |
| 662만 곡 저장 | 상주 1.11 GB | 약 3.7 GB | k=10 5.7 GB / k=30 15.2 GB |
| 새 운영 대상 | 없음 | 없음(이미 설치) | 하나 늘어남 |
| Backend 직접 조회 | 불가(HTTP 경유) | 가능 | 가능 |

pgvector 를 고른 이유는 속도가 아니다. 셋이다.
1. **이미 설치돼 있다** — pgvector 0.7.0. 운영·백업·모니터링 대상이 안 늘어난다.
2. **사용자·플레이리스트와 같은 DB** — 조인과 트랜잭션이 하나로 묶이고 별도 동기화 잡이 없다.
3. **재현율이 기존 그래프보다 높다** — 0.9995 대 0.912.

Neo4j 의 강점인 다중 홉 탐색은 여정이 좌표 보간이라 쓰지 않는다(여정 구현은 BE 담당, D12).

## 실측값 (500,000행, `vector(16)`, HNSW 기본 파라미터)
| 항목 | 측정 | 662만 행 외삽 |
|---|---|---|
| COPY 적재 | 6초 | 약 80초 |
| 힙 | 67 MB | 약 890 MB |
| PK 포함 테이블 | 104 MB | 약 1.4 GB |
| HNSW 인덱스 | 176 MB | 약 2.3 GB |
| 합계 | 280 MB | **약 3.7 GB** |
| HNSW 빌드 | 1,032초 | 4~6시간 (현재 설정) |
| 질의 (warm) | 2.24 ms | — |
| recall@10 | 평균 0.9995 / 중앙 1.0 / 최소 0.9 / 200개 중 199개 완전일치 | — |

외삽은 선형 가정이다. HNSW 빌드는 초선형이라 실제로는 더 걸릴 수 있다.

## 스키마
`track` 테이블(스펙 50 소유)과 1:1 인 별도 테이블로 둔다. 좌표만 바뀌는 재적재가 잦아서다.

```sql
CREATE TABLE track_vector (
    mbid  text PRIMARY KEY REFERENCES track(mbid) ON DELETE CASCADE,
    vec   vector(16) NOT NULL,
    bundle text NOT NULL            -- 예 'v2.2-pca16'. 어느 아티팩트에서 온 좌표인지
);
CREATE INDEX track_vector_hnsw ON track_vector USING hnsw (vec vector_l2_ops);
```

- 차원 16 은 **D7 확정**이다. `manifest.k` 와 같아야 한다.
- 거리는 **L2**(`vector_l2_ops`, 연산자 `<->`). 후처리 규칙의 τ_dup 1.6624·τ_far 4.912 가 전부 L2 거리 기준이라 다른 거리로 바꾸면 규칙이 깨진다.
- `bundle` 컬럼으로 아티팩트 버전을 남긴다. 번들 교체 시 어느 좌표인지 추적한다.
- 제외 곡(`excluded`)은 애초에 넣지 않는다. coords 에 없는 곡이다.

## 질의 계약 (Backend 용)

이웃 top-k:
```sql
-- 1단계: 질의 곡 좌표를 읽는다
SELECT vec FROM track_vector WHERE mbid = :mbid;
-- 2단계: 그 값을 파라미터로 바인딩해서 검색한다
SELECT mbid, vec <-> :qvec AS dist
FROM track_vector
WHERE mbid <> :mbid
ORDER BY vec <-> :qvec
LIMIT :k;
```

### 경고 1 — 질의 벡터를 서브쿼리로 넘기지 마라
아래는 **틀린 결과를 낸다.** 2026-09-10 에 실제로 밟았다.
```sql
-- 금지
SELECT mbid FROM track_vector
ORDER BY vec <-> (SELECT vec FROM track_vector WHERE mbid = :mbid) LIMIT 10;
```
실행계획에서 서브쿼리가 `InitPlan` 으로 들어가고 HNSW 인덱스 스캔이 그 값을 제대로 쓰지 못한다.
측정에서 자기 자신(거리 0)이 1위에 나오지 않고 거리 23.3 짜리가 1위로 나왔다.
반드시 좌표를 먼저 읽어 **리터럴이나 바인드 파라미터**로 넘긴다.

### 경고 2 — 0.7.0 은 필터를 건 검색에서 덜 반환한다
pgvector 0.7.0 에는 iterative index scan 이 없다. HNSW 가 `ef_search` 개 후보를 먼저 뽑고
그다음 `WHERE` 를 적용하므로, 선택도가 높은 필터를 걸면 `LIMIT 10` 을 요청해도 10개보다 적게 나온다.

대응 순서:
1. 자주 쓰는 조건은 **부분 인덱스**를 판다(예: `WHERE is_korean`).
2. 그래도 모자라면 `SET LOCAL hnsw.ef_search = 200` 처럼 후보를 늘린다.
3. 근본 해결은 0.8.0 이상으로 올려 iterative scan 을 쓰는 것이다. 버전 상향은 인프라 결정이다.

## 인프라 선행 조건 ⛔
현재 설정으로는 662만 행 인덱스를 못 짓는다. 실측 근거와 함께 요청한다.

| 항목 | 현재 | 요청 | 이유 |
|---|---|---|---|
| 컨테이너 메모리 | 1 GB | 4~6 GB | 테이블+인덱스 3.7 GB 가 전혀 캐시되지 않는다 |
| `maintenance_work_mem` | 64 MB | 2 GB | 인덱스 2.3 GB 가 안 들어가 디스크 경로로 짓는다. 50만 행에 17분 걸렸다 |
| 컨테이너 CPU | 1 | 2 이상 | pgvector 0.7 은 병렬 빌드를 지원한다 |
| `shared_buffers` | 128 MB | 1 GB 이상 | 같은 이유 |

app-node 호스트 여유는 13.3 GB 다(2026-09-10 측정). PostgreSQL·Redis·Neo4j·backend 가 나눠 쓴다.
이 변경은 인프라 담당 합의 사항이다. **합의 전에는 662만 행 적재를 시작하지 않는다.**

## 수용 기준
- AC1 `track_vector` 에 `manifest.songs` 와 같은 행 수가 들어가고, 전 행의 `bundle` 이 `CURRENT.json` 의 번들과 같다.
- AC2 무작위 곡 200개의 top-10 을 numpy 정확 kNN 과 대조해 **recall@10 평균 ≥ 0.99**. 측정 코드는 `tests/bench_pgvector.py`, 결과는 `output/pgvector_recall_<번들>.json`.
- AC3 같은 200개 질의의 **p95 ≤ 50ms**(Backend 커넥션 풀 기준, psql 기동 시간 제외).
- AC4 이웃 결과에 `excluded` 곡이 0건, 길이 규칙 위반 0건. `music` 에 `excluded=false` 인 곡만 적재하므로 적재 단계에서 보장된다. 후처리 임계값 적용은 BE 담당이다(D12).
- AC5 인덱스 빌드가 끝나고 `pg_relation_size('track_vector_hnsw')` 가 기록된다. 소요 시간도 함께.
- AC6 서브쿼리 금지와 필터 제약이 Backend 연동 문서에 들어가 있다.
- AC7 좌표 불변성: 적재 전후로 같은 mbid 의 좌표가 비트 단위로 같다(Jira S15P21A405-35 게이트).

## 비범위
- Backend 코드 변경. 계약만 정하고 구현은 BE 담당.
- 기존 numpy 경로 철거.
- 마이그레이션 도구 선정(열린 질문 Q2).
- 여정·트리 탐색을 SQL 로 옮기는 것. 좌표 이웃만 다룬다.
- pgvector 버전 상향.
