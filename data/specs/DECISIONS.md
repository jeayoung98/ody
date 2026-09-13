# 결정 기록 (재론 금지 — 바꾸려면 새 번호로)

실험 트랙의 결정 1~5 는 `output/HANDOVER.md` §4. 여기서는 개발 트랙(2026-09-07 ~) 만.

| # | 날짜 | 결정 | 근거·수치 | 영향 |
|---|---|---|---|---|
| D1 | 2026-09-07 | 카탈로그 길이 규칙 **60s ~ 6min** (미만·초과 제외, 표시). 5min 안은 기악곡 제거 의도였음 | 60~360s 유지 5,528,439 (제외 16.5%), 브릿지 손실 8.3%, 정답쌍 손실 4.9%. 5min 안은 26.5% 제외·정답쌍 12.8% 손실 | `exclusion_rules.json` R1 v4 → dry-run → `serving/v2.2-pca16`. 중단 기준 15% 는 사용자 결정으로 갱신(16.5% 허용) |
| D1b | 2026-09-07 | 기악곡 판별은 길이 대신 **제목 표기 `flag_instrumental`**(1차, 33,487곡) + AB highlevel `voice_instrumental`(2차) | 6min 초과 곡 중 제목으로 기악 확인 가능한 건 0.3% — 길이는 기악의 약한 대용치 | flag 컬럼 추가, 서빙 후순위 |
| D2 | 2026-09-07 | 여정 기본 `mode=linear`(직선 보간). `mode=axis`(축 우선 DP)는 **내부 A/B 플래그**, UI 토글 없음 | 청취 관찰(09-07): 직선 보간 우세. 표본 여정 1개라 행동 로그로 결정 | `11_journey` API `mode` 인자 |
| D3 | 2026-09-07 | 먼 곡도 **항상 잇는다**. 거리 > 10.7 이면 `far:true` 표시, 역 수 = clamp(10 + (dist−10.7), 10, 20). 먼 여정은 리프 중심 그래프 경로 위 보간(시간 되면 1차, 아니면 2차) | 사용자: 사용자는 먼 곡을 시험할 것. 15.29 여정은 직선 중간이 재즈 지대 | `11_journey` |
| D4 | 2026-09-07 | 검색 서비스 = **Python FastAPI** + numpy(+faiss 선택). BE 게이트웨이가 호출 | 검증된 numpy 코드 재사용, 재구현·재검증 시간 없음. 병목은 행렬 연산 | `10/11/12` API 형태 |
| D5 | 2026-09-07 | '오래됐고 인기 없는 곡' 은 **1차 제외 안 함**. 2차: 발매연도 = MusicBrainz `recording_first_release_date`, 인기 = MLHD 청취 합산(+ListenBrainz/Last.fm 보조). 제외가 아닌 **서빙 티어** | YouTube Data API 는 하루 100곡(할당량), 스크래핑은 약관 위반, 매칭 오염 | 2차 스펙 `40_popularity_tier`(미작성) |
| D6 | 2026-09-07 | 서빙은 기존 아티팩트(v2.2)로 배포. **Spark 이식은 패리티 트랙**(서빙 선행조건 아님) | 6.5 작업일. 두 트랙을 묶으면 둘 다 미완 | `plan_release1.md` |
| D8 | 2026-09-10 | **Spark 와 Hadoop 을 모두 실제로 사용한다 (프로젝트 요건).** 잡의 입출력은 `hdfs:///` 경로, 제출은 `spark-submit --master yarn`. 로컬 `pyspark local[*]` 은 개발용이며 완료 증거 아님. 컷 대상은 처리 범위(원본 630GB·전곡)이지 실행 환경이 아니다 | 사용자 확인(2026-09-10). 기존 컷 순서 1번이 S0 적재를 자르고 plan 이 로컬 `local[8]` 패리티를 허용해, 컷이 발동하면 Hadoop 사용 증거가 남지 않는 구멍이 있었다. 클러스터는 이미 준비됨(S15P21A405-46 완료: HDFS DataNode 2, YARN NodeManager 2, Spark 4.2.0 on YARN VERIFIED) | 스펙 20 **AC0** 신설(+AC5), `AGENTS.md` 규칙 10, `plan_release1.md` §4 컷 순서·절대 자르지 않는 것, `spark/README.md` 증거 수집 절차 |
| D11 | 2026-09-10 | **적재 5단계와 `music` 테이블 필드 확정.** `location` 은 **PCA-16 지도 좌표**(아티스트 지역 아님)이고 `music.location vector(16)` 에 넣는다. `release_year`·`album`·`youtube_url` 은 **컬럼만 만들고 1차 NULL**. 테이블 이름은 **`music`** 으로 통일하고 스펙 17 의 `track_vector` 를 `music.location` 으로 합친다 | 사용자 지정(2026-09-10). 필드 감사 실측: `bpm` 은 270 특징의 3번째 `rhythm.bpm` 으로 보유. `release_year`·`album` 은 `catalog_audit.py` A8 기록대로 원본 재패스가 필요해 2차. `youtube_url` 은 규칙 6(검색 URL 만)과 YouTube API 하루 100곡 할당량으로 662만 곡이면 66,000일 — 채울 방법이 없다. 조회 시 검색 URL 생성으로 대체. 장르 커버리지는 `bridge_v2.parquet` 67,472곡으로 전체의 **1.0%** 이고 나머지 99%는 `music_genre` 행이 없는 것이 정상 | 새 스펙 `18_db_ingest`, 스펙 17(`track_vector` → `music.location`), 스펙 50(`track` → `music`) |
| D7 | 2026-09-10 | 좌표 차원은 **PCA-16**. Jira S15P21A405-35 설명의 "dim 64" 는 기획 초기 값이며 **설명 쪽을 갱신**한다 | 서빙 아티팩트가 `manifest.k=16`, `coords_v2.parquet` 이 `pc1..pc16`. 64 로 가려면 재학습이 필요하고 major 버전 + 게이트 재등록이라 1차 기간에 불가(규칙 3). 사용자(재영) 확인 | `50_db_schema` `track_vector` 스키마, Jira 35 설명 갱신. 열린 질문 Q1 종료 |

| D13 | 2026-09-10 | **`music.id` 는 적재가 부여한다. `mbid` 오름차순 1..6,624,399.** BE 가 만든 실제 스키마를 따르고 스펙 18 초안(`mbid` PK)을 실제에 맞춘다 | 실측: `music.id BIGINT` 가 PK 인데 DEFAULT·IDENTITY·시퀀스가 없다(`playlist_id_seq` 만 존재). `music_genre` 도 `music_id` 를 참조한다. mbid 정렬 부여는 같은 입력에 같은 id 를 주므로 재적재가 멱등이다. 사용자 확인(2026-09-10) | `ingest/build_csv.py`, 스펙 18 실제 스키마 절·AC1, BE 전달 사항(새 곡은 6,624,400 부터) |
| D14 | 2026-09-11 | **지도 레이어는 트리 노드가 아니라 좌표 쌍이다.** 1레이어 (pc1,pc2) … 8레이어 (pc15,pc16) 이고 앞 레이어 근처로 필터하며 내려가는 드릴다운이다. 스펙 16 의 `map_layer`·`track_position` 노드 집계 적재는 쓰지 않는다 | 사용자 확인(2026-09-11). 이 구조면 필터 사슬에 항상 (pc1,pc2) 가 들어가 인덱스 하나로 충분하다. 실측: 첫 화면 20,941 ms → 0.4 ms(미리 계산 + 조인 제거), 2레이어 82 ms, 3레이어 145 ms, 평면 최근접 0.24 ms. GiST 를 사각 범위에 둘 다 쓰면 BitmapAnd 로 355 ms 로 되레 느려진다 | 스펙 16 전면 갱신(원안 보존), `ingest/build_map_layer.sql`·`map_layer_queries.sql`·`map_grid.py`, `output/map_layer_bench_2026-09-11.json` |
| D15 | 2026-09-13 | **규칙 6 개정 — 음원 파일 재생·다운로드·스크래핑 금지는 유지, 재생은 공식 플레이어 임베드(YouTube IFrame Player)로만 허용.** `video_id` 확보 대상은 `map_sample`(1,094곡)과 검색 상위로 한정하고 전곡 적재는 D11 대로 하지 않는다(범위 예외, D11 은 뒤집지 않는다). 확보 조건: 곡 길이 ±3초(공식 채널은 ±30초) 일치 + `status.embeddable == true`, 미달이면 NULL. `video_id` 없는 곡은 검색 URL 만 | 규칙 6 을 지키느라 FE 가 재생을 새 탭으로 넘겨 플레이어 진행 바가 가짜 30초 루프이고 정지·다음·이전이 동작하지 않았다. 근거를 가르면 스크래핑 약관 위반(D5)은 유효, 662만 곡 × 하루 100곡 = 66,000일(D11)은 전곡 기준에서만 유효. IFrame Player 는 스크래핑이 아니라 YouTube 가 제공하는 임베드이고 광고·조회수가 원저작자에게 간다. `map_sample` 1,094곡은 하루 100곡이면 11일, 확보율 66% 가정 시 약 720곡 | `AGENTS.md` 규칙 6, 스펙 15 §규칙 6 과의 관계, 스펙 18 `youtube_url` 절. 확보 스크립트·적재는 별도 이슈. FE(플레이어 임베드)·BE(`video_id` 응답 필드)에 통보. Jira S15P21A405-290 |
---

## 열린 질문 (결정 대기 — 답이 나오면 위 표에 D7.. 로 옮긴다)

스펙을 쓰다 실제 데이터·저장소와 Jira 문구가 어긋나는 것을 발견한 항목이다. **한쪽을 임의로 고르지 않는다.**

| # | 질문 | 상충 | 임시 진행 방식 | 관련 |
|---|---|---|---|---|
| ~~Q1~~ | ~~`track_vector` 차원이 16인가 64인가~~ | **종결 2026-09-10 → D7 (PCA-16).** Jira 35 설명을 갱신한다 | — | `50_db_schema` |
| ~~Q2~~ | ~~마이그레이션 도구~~ | **종결 2026-09-11.** BE 가 `ody` DB 에 `music`·`genre`·`music_genre` 를 이미 만들었다. data 는 DDL 을 쓰지 않고 데이터만 넣으므로 도구를 고를 일이 없다 | — | `50_db_schema` 종결 |
| Q3 | 멜론 소분류 코드표 확보 가능 여부 | `genre_gn_all.json` 부재(원 출처 Kakao Arena 재다운로드 필요). 대분류 21개만 보유 | 1차는 대분류만. 소분류는 보류 | `13_genre_hierarchy` |
| Q4 | 축 라벨의 태그 출처 | Jira S15P21A405-38 은 Last.fm 태그 log-odds. 저장소에는 AcousticBrainz 자유 텍스트 태그(`work/genres_raw.parquet` 23,203,978행)만 있고 Last.fm 데이터는 없다 | 보유한 AB 태그로 진행하고 출처를 문서에 명시 | `14_axis_labels`, `13_genre_hierarchy` |
| Q5 | 트리 축 할당 방식 표기 | Jira S15P21A405-37 은 "depth별 PC 축 2개". 실제는 **노드별 local PCA-2**(`split_axes.npz`) | 실제 아티팩트를 따르고 Jira 설명 갱신을 제안 | `16_map_layer_serving` |
| ~~Q6~~ | ~~Vector DB 도입 여부~~ | **종결 2026-09-10 → D9 (pgvector).** app-node 실측으로 Neo4j 와 비교해 결정 | — | `17_pgvector_serving`, `50_db_schema` |
| Q7 | 빠진 특징 2파트를 재추출할까 | `work/v2_feats` 는 30파트 중 **28파트**(`part10`, `part24` 없음). 6,617,603행. coords 6,624,399곡 중 **733,146곡(11.1%)에 특징이 없어** 전곡 패리티 검증 불가. 교집합 5,891,253곡(88.9%)은 가능. 원본 tar.zst 2개와 추출기(`dmadkr/scripts/extract_v2_features.py`)는 있고 파트당 약 5분 | 재추출을 제안한다. 15분이면 전곡 검증이 열리고, 안 하면 스펙 20 S3 의 "전곡" 기준을 교집합으로 낮춰야 한다 | `20_spark_pipeline` AC5·S3, `output/hdfs_ingest_2026-09-10.json` |
