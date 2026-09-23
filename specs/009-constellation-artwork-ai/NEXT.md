# 남은 일 — 별자리 작품·고양이 플레이리스트

**기준일**: 2026-09-23 · **브랜치**: `backend/feat/S15P21A405-595-cat-playlist-generator` (push 됨, MR 전)
**배포 상태**: 563(AI 채점·리더보드)은 `backend:21` 로 운영 중. 595(고양이 생성·좌표계 전환)는 코드 완료, 미배포.

순서대로 한다. 위가 먼저다.

---

## 1. 지금 — 배포까지 (사람)

| # | 할 것 | 누가 | 어떻게 |
| --- | --- | --- | --- |
| 1-1 | **MR 생성** → `backend/dev` | 너 | [MR 링크](https://lab.ssafy.com/s15-bigdata-dist-sub1/S15P21A405/-/merge_requests/new?merge_request%5Bsource_branch%5D=backend%2Ffeat%2FS15P21A405-595-cat-playlist-generator). 제목·설명은 `mr-595.md`(세션 스크래치에 있음, 없으면 이 문서 §6 요약으로) |
| 1-2 | 리뷰·머지 | 팀 | 리뷰 포인트: `PlanarProjection` 의 의미 변경(집합 PCA → pc1/pc2) 을 팀이 알고 머지하는가 |
| 1-3 | `backend/dev` → `backend/jenkins` MR → 배포 | 너 | Jenkins `backend-pipeline` 이 webhook 으로 뜬다. 3분쯤 |
| 1-4 | 배포 확인 | Claude | `docker ps` 에 새 태그, nginx 슬롯 전환, `[Artwork]` WARN 없음, `GET /api/artwork/templates` 200 |

**전제**: 스키마 변경 없음 → DDL 실행 없음. env 변경 없음.

---

## 2. 배포 직후 — 실측 (Claude, 토큰 1개 필요)

토큰: 프론트 로그인 상태에서 `F12 → Application → Local Storage → ody:access-token`. 30분 만료.

| # | 할 것 | 판정 기준 |
| --- | --- | --- |
| 2-1 | `POST /api/artwork/generate` 를 `sitting`·`sketch`·`loaf` 로 각 1회 | 셋 다 `201`. `musicCnt` = 23·18·17. 곡 중복 없음 |
| 2-2 | `fitError` 기록 | **< 0.15 면 통과**(SC-008 잠정). 넘으면 곡 밀도 문제 — `SCALES` 에 더 작은 배율 추가 또는 `CANDIDATES_PER_POINT` 상향 |
| 2-3 | 응답 `points` 를 `ArtworkRenderer` 와 같은 규칙으로 그려 눈으로 확인 | 고양이로 보이는가. `GmsScoreProbe` 의 렌더 경로 재사용 |
| 2-4 | `POST /api/constellations/layout` 을 같은 곡으로 호출 | `generate` 의 `points` 와 **같은 값**(FR-018) |
| 2-5 | 가장 나은 플리를 `POST /api/artwork/submit` → 5초 뒤 `detail` | 점수·코멘트. **무작위 10곡(9점)보다 뚜렷이 높아야** 한다(SC-007). 60 이상이면 성공, 30 이하면 §5-1 |
| 2-6 | 서버에서 `EXPLAIN (ANALYZE) ` + `findNearestMusicByPc12` 쿼리 | `Index Scan using music_l1_gist` 가 나와야 한다. `Seq Scan` 이면 첨자 표현식이 인덱스와 다른 것 — mapper 주석 참고 |
| 2-7 | 기존 작품 6(집합 PCA 스냅샷) 의 `detail` | 좌표가 그대로인가(스냅샷은 불변이어야 한다). `layoutVersion` 이 `v2.1-pca16` 으로 남아 구분되는가 |

결과는 `plan.md` "후속" 절 아래에 표로 남긴다. 기준값(SC-007/008)은 실측 뒤 확정한다.

---

## 3. 팀 결정 (기획·팀) — 코드 아님, 병행

| # | 결정 | 근거 문서 | 안 정하면 |
| --- | --- | --- | --- |
| 3-1 | **PATH-01 좌표계 변경 승인** — 집합 PCA → pc1/pc2 고정축 | FEATURES 변경 제안 **#28**, BACKEND-NOTES §6-7 | 배포하면 임의 플리·여정 별자리가 지금과 달라 보인다. 승인 없이 배포하면 기획이 놀란다 |
| 3-2 | **고양이 생성 기능 신설** (PATH-03) | FEATURES **#29** | 명세에 없는 기능이 운영에 있다 |
| 3-3 | 563 정책 — 회차당 1작품, 재제출 시 점수·좋아요 소멸 | spec.md Clarifications 2026-09-22, tasks T000a | 이미 운영 중. 뒤집으면 `UQ` 인덱스·`submit` 로직 변경 |
| 3-4 | **GMS 비용** — 호출당 20 Credit, 사용자당 최대 80, 100명 = 8,000 | plan.md "결정", tasks T000e | 회차 열어 두면 계속 나간다. 상한 정책 없음 |
| 3-5 | SOCIAL-12(주간 좋아요 랭킹)와 이 리더보드(AI 점수)의 관계 | spec.md "기능 명세와의 관계" | 화면에 랭킹이 둘 생긴다 |

---

## 4. 프론트 (FE 파트)

BACKEND-NOTES **§6**(563) · **§6-7**(595) 에 계약이 있다. FE 쪽 할 일만 적는다.

| # | 할 것 | 주의 |
| --- | --- | --- |
| 4-1 | `types/api.ts` 에 에러 코드 4개 — `ARTWORK_NOT_FOUND` `ARTWORK_ROUND_CLOSED` `ARTWORK_NOT_FAILED` `ARTWORK_RETRY_EXHAUSTED` | |
| 4-2 | 리더보드 화면 — `GET /api/artwork/leaderboard` (비로그인 가능) | `rank` 서버 계산. 기준 그림은 이미 제외돼 온다 |
| 4-3 | 작품 상세 — `detail.points` 로 별자리 렌더 | `points` 형식 = `layout` 과 동일. 기존 별자리 컴포넌트 재사용 |
| 4-4 | 제출 흐름 — 응답이 `PENDING`, **재조회 필요**(폴링 or 재진입). 소켓 없음 | `FAILED` 는 `score: null`. 0 으로 그리지 말 것 |
| 4-5 | 재제출 경고 — "지금 점수·좋아요가 사라진다" 고지 후 `submit` | 서버는 확인 없이 교체한다 |
| 4-6 | 고양이 생성 — `templates` → `generate` → 별자리 미리보기 → `submit` 버튼 | `fitError` 는 표시해도 무시해도 됨 |
| 4-7 | 곡 수 2~30 안내 | 31곡 플리 제출은 400 |
| 4-8 | **`layout` 값이 바뀐 것 인지** — 코드 변경은 없지만 기존 플리 별자리 모양이 달라진다 | 3-1 승인과 함께 |

---

## 5. 알려진 한계 → 필요해지면 (백엔드)

| # | 한계 | 언제 손댈지 | 어떻게 |
| --- | --- | --- | --- |
| 5-1 | **점수 변별력** — 실제 제출물이 전부 낮은 점수로 뭉치면 리더보드가 좋아요 순이 된다 | 2-5 에서 `sitting` 이 30 이하일 때 | `theme_prompt` UPDATE(배포 불필요) → 기준 그림 교체/추가(`artwork` anchor 행) → 모델 변경(`GMS_MODEL` env). 순서대로 |
| 5-2 | **꼬리 누락 미감점** — 6회 실험 전부 못 뚫었다 | 실제 제출물에서 "꼬리만 없는 완성형" 이 자주 나올 때 | 지각은 모델·기준 그림으로만 좋아진다. 코드로는 못 고친다 |
| 5-3 | 기준 그림이 `detail?artworkId=1~4` 로 조회된다 (`anchor@ody.system`) | 누가 악용하거나 보기 싫을 때 | `ArtworkService.getDetail` 에 `isAnchor → ARTWORK_NOT_FOUND` 한 줄 |
| 5-4 | 템플릿이 코드 상수 — 회차 주제가 바뀌면 배포 필요 | 2회차 주제 정해질 때 | 회차마다 `CatTemplate` 추가. 회차가 셋 넘으면 `artwork_round` 에 템플릿 JSON 칼럼 |
| 5-5 | 곡 밀도 낮은 자리의 점이 어긋난다 | 2-2 의 `fitError` 가 크면 | `SCALES` 세분화, 상자 백분위 5~95 로 좁히기, 후보 풀을 1레이어 상주로 제한하는 옵션 |
| 5-6 | 스케줄러 배치가 한 트랜잭션 — HTTP 왕복 동안 커넥션 1개 점유 | 제출이 초당 수 건 이상 | `EVALUATING` 상태 추가해 락 없이 선점 (`ArtworkEvaluationScheduler` ponytail 주석) |
| 5-7 | 관측 미터 없음 — 로그로만 본다 | `PENDING` 적체가 보일 때 | `artwork` 상태별 count 게이지 + GMS 호출 타이머 |
| 5-8 | 자유 그리기(1-a) 없음 — 템플릿만 | 기획이 원할 때 | `generate` 에 `points[]` 입력 받는 변형. 생성기는 그대로 |

---

## 6. 정리 (선택)

| # | 할 것 |
| --- | --- |
| 6-1 | 테스트로 만든 `playlistId=5` "cat e2e 1", `artworkId=6`(9점) — 리더보드 첫 항목으로 둘지 지울지. `DELETE /api/artwork/6`, `DELETE /api/playlist/delete/5` |
| 6-2 | 작업 트리에 남은 다른 작업 — `backend/build.gradle`, `application.yml`(Redis lettuce pool), `infra/k6/README.md`, `RealtimeFanoutBenchmarkRedisIntegrationTests.java`. 595 와 무관. 해당 이슈 브랜치에서 커밋할 것 |
| 6-3 | 세션 스크래치의 진단 스크립트(`gen-probe.sh`, `gms-probe*.sh`) — 저장소에 넣을지. 넣으면 `backend/src/test/resources/artwork-probe/` 정도. 키는 안 들어 있다 |

---

## 참조

| 문서 | 내용 |
| --- | --- |
| [spec.md](./spec.md) | 요구·결정. US1~4, FR-001~021, Clarifications 22일·23일 |
| [plan.md](./plan.md) | 설계, GMS 실험 6회 결과표, 모델 결정, 좌표계 전환 이유 |
| [tasks.md](./tasks.md) | T000~T050. 완료/미완 체크 |
| [BACKEND-NOTES §6·§6-7](../../docs/rules/BACKEND-NOTES.md) | 프론트 계약 |
| [FEATURES #28·#29](../../docs/rules/FEATURES.md) | 기획 변경 제안 |
| `backend/src/main/resources/db/artwork_001_tables.sql`, `artwork_002_anchors.sql` | 운영 적용 완료 DDL |
| Jira | S15P21A405-548(설계, 완료) · 563(채점·리더보드, 배포됨) · 595(고양이 생성·좌표계, MR 전) |
