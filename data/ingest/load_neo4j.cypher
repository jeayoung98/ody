// 스펙 18 5단계 — Neo4j 적재 (Jira S15P21A405-209)
// 2026-09-10 에 실제로 돌린 것이다. 실측: Music 노드 6,624,399개 653초, 장르 그래프 157초.
//
// 실행:
//   docker cp neo4j_music.csv ody-neo4j:/var/lib/neo4j/import/
//   docker cp load_neo4j.cypher ody-neo4j:/var/lib/neo4j/import/
//   docker exec ody-neo4j bash -lc '/var/lib/neo4j/bin/cypher-shell \
//     -u "${NEO4J_AUTH%%/*}" -p "${NEO4J_AUTH#*/}" -f /var/lib/neo4j/import/load_neo4j.cypher'
//
// 주의: cypher-shell 5.26 에는 `:auto` 명령이 없다. 명시 트랜잭션을 열지 않으면 기본이
// auto-commit 이라 CALL {} IN TRANSACTIONS 가 그대로 돈다. `:auto` 를 붙이면 실패한다.
// 힙이 512MB 라 한 트랜잭션에 다 넣으면 죽는다. 배치가 필수다.

CREATE CONSTRAINT music_id_unique IF NOT EXISTS FOR (m:Music) REQUIRE m.id IS UNIQUE;
CREATE INDEX music_mbid_idx IF NOT EXISTS FOR (m:Music) ON (m.mbid);

// 1) Music 노드. location 은 16개 float 배열이고 거리 계산은 하지 않는다(D9 — pgvector 담당).
LOAD CSV WITH HEADERS FROM 'file:///neo4j_music.csv' AS row
CALL {
  WITH row
  CREATE (m:Music {
    id: toInteger(row.id),
    mbid: row.mbid,
    location: [x IN split(row.location, ';') | toFloat(x)],
    genres: CASE WHEN row.genres IS NULL OR row.genres = '' THEN [] ELSE split(row.genres, ';') END
  })
} IN TRANSACTIONS OF 10000 ROWS;

// 2) Genre 노드 — 멜론 대분류 코드 29개
CREATE CONSTRAINT genre_name_unique IF NOT EXISTS FOR (g:Genre) REQUIRE g.name IS UNIQUE;
MATCH (m:Music) WHERE size(m.genres) > 0
UNWIND m.genres AS code
WITH DISTINCT code
MERGE (:Genre {name: code, source: 'melon'});

// 3) HAS_GENRE 관계 — 71,285개. 곡 66,036개만 장르가 있다(커버리지 1.0%)
MATCH (m:Music) WHERE size(m.genres) > 0
CALL {
  WITH m
  UNWIND m.genres AS code
  MATCH (g:Genre {name: code})
  MERGE (m)-[:HAS_GENRE]->(g)
} IN TRANSACTIONS OF 5000 ROWS;

// 4) 검증 (스펙 18 AC7)
MATCH (m:Music) RETURN count(m) AS music_nodes;
MATCH (g:Genre) RETURN count(g) AS genre_nodes;
MATCH ()-[r:HAS_GENRE]->() RETURN count(r) AS has_genre_edges;
