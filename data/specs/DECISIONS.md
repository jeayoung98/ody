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
| D7 | 2026-09-10 | 좌표 차원은 **PCA-16**. Jira S15P21A405-35 설명의 "dim 64" 는 기획 초기 값이며 **설명 쪽을 갱신**한다 | 서빙 아티팩트가 `manifest.k=16`, `coords_v2.parquet` 이 `pc1..pc16`. 64 로 가려면 재학습이 필요하고 major 버전 + 게이트 재등록이라 1차 기간에 불가(규칙 3). 사용자(재영) 확인 | `50_db_schema` `track_vector` 스키마, Jira 35 설명 갱신. 열린 질문 Q1 종료 |

---

## 열린 질문 (결정 대기 — 답이 나오면 위 표에 D7.. 로 옮긴다)

스펙을 쓰다 실제 데이터·저장소와 Jira 문구가 어긋나는 것을 발견한 항목이다. **한쪽을 임의로 고르지 않는다.**

| # | 질문 | 상충 | 임시 진행 방식 | 관련 |
|---|---|---|---|---|
| ~~Q1~~ | ~~`track_vector` 차원이 16인가 64인가~~ | **종결 2026-09-10 → D7 (PCA-16).** Jira 35 설명을 갱신한다 | — | `50_db_schema` |
| Q2 | 마이그레이션 도구 (Flyway / Liquibase / 수동 SQL) | `docs/infra/DATABASE.md` 가 domain 도입 전 결정으로 유보 | 결정 전 DDL 커밋 금지 | `50_db_schema` |
| Q3 | 멜론 소분류 코드표 확보 가능 여부 | `genre_gn_all.json` 부재(원 출처 Kakao Arena 재다운로드 필요). 대분류 21개만 보유 | 1차는 대분류만. 소분류는 보류 | `13_genre_hierarchy` |
| Q4 | 축 라벨의 태그 출처 | Jira S15P21A405-38 은 Last.fm 태그 log-odds. 저장소에는 AcousticBrainz 자유 텍스트 태그(`work/genres_raw.parquet` 23,203,978행)만 있고 Last.fm 데이터는 없다 | 보유한 AB 태그로 진행하고 출처를 문서에 명시 | `14_axis_labels`, `13_genre_hierarchy` |
| Q5 | 트리 축 할당 방식 표기 | Jira S15P21A405-37 은 "depth별 PC 축 2개". 실제는 **노드별 local PCA-2**(`split_axes.npz`) | 실제 아티팩트를 따르고 Jira 설명 갱신을 제안 | `16_map_layer_serving` |
| Q6 | Vector DB 도입 여부 | Jira 35 는 "Vector DB 동기화" 언급. 팀 확정 기술 목록(루트 `AGENTS.md` §3)에는 없음 | 1차 미사용 | `50_db_schema` |
