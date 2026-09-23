# 21 신곡 증분 적재 (분산 파이프라인, id 이어 붙이기) — spec

상태 ✅ 클러스터 S1.5~S7 + 운영 적재 84곡 완료(2026-09-23) · map_sample 재빌드 미실시 · Jira **S15P21A405-600** · 결정 **D20** · 선행: 스펙 18(적재), 스펙 20(Spark S1.5~S7)

## 목적
AcousticBrainz 덤프에 없는 곡(essentia 2.1-beta2 lowlevel JSON, MusicBrainz mbid 없음)을 **기존 곡의 id·좌표를
건드리지 않고** `music` 에 더한다. 좌표는 전곡과 같은 동결 번들로 YARN 에서 계산한다(D8).

## 흐름
```text
로컬   spark/prepare_new_songs.py   songs.csv(json,title,artist[,album]) → raw.jsonl · meta.parquet · album.parquet · report.json
클러스터 spark/run_new_songs.sh      S1.5 --from-raw → S2 → S3 → S5(--coords, --quantile-base)
클러스터 ingest/run_db_load.sh --append   S7(--id-start MAX(id)+1) → CSV → load_postgres.sh(ODY_APPEND=1, INSERT)
```
S1(대표 제출본)·S4(트리)·S6(번들)은 타지 않는다. 신곡은 제출본이 하나고, node_paths·번들은 DB 로 가지 않는다.

## 전곡 경로와 다른 점
| 항목 | 전곡 | 증분 |
|---|---|---|
| mbid | 덤프 recording MBID | 태그가 없으면 `md5_encoded` 기준 합성 uuid5 (D20) |
| 지문 | 네 문자열 완전 일치 | build_sha 만 비면 나머지 세 값으로 코호트 지문을 찾는다 (D20) |
| S5 분위(R8·R15) | 입력 자신 | 전곡 `catalog_input` (`--quantile-base`) |
| S5 묶음(R5·R6) | 전곡 | 배치 안에서만 |
| 태그·A5 | `genres_raw`·감사 | 없음 (has_tag=False, a5_keywords=[]) |
| id | mbid 오름차순 1..N (D13) | `id_start..` mbid 오름차순, 기존 id 불변 |
| 적재 | 빈 테이블 COPY | 임시 테이블 COPY → 같은 mbid 삭제 → id 검사 → INSERT, 인덱스 유지 |

## 범위 밖
- 기존 곡과 같은 곡인지 판정(R5·R6 전곡 대조). 같은 음원을 다른 mbid 로 넣으면 중복이 생긴다.
- `map_sample` 재빌드 — 신곡은 `build_map_layer.sql` 을 다시 돌리기 전까지 지도 대표곡에 나오지 않는다. 주변 탐색·검색은 HNSW·일반 조회로 바로 된다.
- 음원 확보. 규칙 6 — 음원 다운로드·스크래핑은 금지다. lowlevel JSON 의 출처는 입력 제공자가 책임진다.

## 수용 기준
- AC1 증분 적재 후 기존 곡의 id·좌표가 바뀌지 않는다 (`load_postgres.sh` 는 INSERT 만 한다).
- AC2 신곡 id 는 적재 시점 `MAX(id)+1` 부터 연속이다. 그 사이 다른 곡이 들어왔으면 적재가 멈춘다(잠금 안 검사).
- AC3 같은 배치를 두 번 적재해도 행이 늘지 않는다 (mbid 멱등, 합성 mbid 는 결정적).
- AC4 신곡 좌표가 `ingest/add_song.py` 단건 결과와 1e-4 이내로 같다 — 클러스터 실행으로 확인.
- AC5 build_sha 없는 beta2 JSON 은 코호트 지문으로 해석돼 R4 를 지나고, beta1 등 코호트 밖은 여전히 제외된다 (`tests/test_new_songs.py`).
- AC6 `exclusion_rules.json`·`rules_hash` 가 바뀌지 않는다 — 전곡 카탈로그 패리티가 그대로 돈다.

## 검증 기록
- 2026-09-23 로컬: `Perk Up` 1곡 → mbid `f3274d5c-b750-5e6b-845b-9de5868b968a`, 지문 72(build_sha 없이 해석), n_clipped 0. `pytest data/tests` 전체 통과.
- 2026-09-23 로컬: 지원밴드 20곡 배치 `work/new_songs/jiwon-band-2026-09-23` — 20곡 모두 지문 72, n_clipped 0, S5 행 단위 규칙 통과. 사람이 준 목록(title·artist·album·길이)과 JSON 길이가 20곡 모두 1초 이내로 일치해 순번 매핑을 확인했다. 카탈로그(v2.1) 중복 의심 2곡: The Script - Breakeven, 가을방학 - 취미는 사랑 (artist_norm·title_norm 일치).
- 2026-09-23 클러스터(YARN, 18곡 — 중복 의심 2곡 제외): S1.5 18행·270 특징 → S2 18 → S3 18 → S5 18행 제외 0 (R8 분위 8.7046e-05 = D18 전곡 dry-run 값, `--quantile-base` 동작 확인). **AC4 통과** — 클러스터 좌표와 로컬 `serving_transform` 최대 차 2.0e-07. S7 `--id-start 4694203`(운영 MAX(id)=4,694,202) → music.csv 18행, id 4694203..4694220 연속, album 채워짐. 첫 제출에서 `feature_select.select_270` 이 점 들어간 컬럼을 백틱 없이 select 해 UNRESOLVED_COLUMN — 고쳤다(`--from-raw` 경로 첫 클러스터 실행).
- 2026-09-23 운영 적재(사용자 요청으로 Claude 가 실행): 배치 3개 `jiwon-band`(18) → `bots`(48, 봇 5종) → `seven`(18) 순서로 `run_db_load.sh --append --apply`. 적재 전 `music` 4,648,531행·MAX(id) 4,694,202 → 적재 후 4,648,615행·MAX(id) 4,694,286. **AC1** 기존 행 수 그대로(+84 만). **AC2** 신곡 84행 id 4694203..4694286 span 84 연속, 배치마다 잠금 안 검사 NOTICE 로 stage min id > table max 확인. **AC3** 배치 1 재적재 → DELETE 18 · INSERT 0. mbid 84 고유, location 16차원 84, album 58. 97곡 입력 중 카탈로그 중복 28·instrumental 2 는 넣지 않았다(판정표는 사람 확인 목록 기준). 롤백: `DELETE FROM music WHERE id BETWEEN 4694203 AND 4694286`. map_sample 은 재빌드하지 않았다.
- 2026-09-23 video_id·release_year: `data/videoid` 판정으로 84곡 중 video_id 72(verified 7 · best_guess 65), 영상 음원 메타데이터 release_year 38. 운영 반영은 `output/new_songs_2026-09-23_videoid_year.sql`(비어 있는 칸만, DBeaver Alt+X) — 실행 전이다.
- map_sample 재빌드(`ingest/build_map_layer.sql`, psql 메타명령이라 DBeaver 불가)는 실행 전이다. Claude 실행은 권한 분류기가 막았다.
