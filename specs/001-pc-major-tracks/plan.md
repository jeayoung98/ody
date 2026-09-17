# Implementation Plan: PC 레벨·중심좌표 기반 대표곡 조회

**Branch**: `backend/feat/S15P21A405-50-music-major` | **Date**: 2026-09-08 | **Spec**: [spec.md](spec.md)
**Input**: spec.md의 Q1~Q5 및 youtubeCnt/playCnt 후속 보충.
**Status**: 설계 확정(D15~D19, 2026-09-11). **B2·B6 해소, B3 부분 해소** → 조회 port·어댑터 착수 가능.
잔여 게이트는 B1(입력 검증)·B4(빈 결과 계약)·B5(만료 코드)·B3(장르 필터)다.
tasks.md 생성됨. 게이트 독립 순수 로직·테스트는 2026-09-10 구현 완료(S15P21A405-50).

> ## ⟲ 2026-09-11 D15 — 조회 구역 모델 변경 (롤백 가능)
>
> spec 의 FR-012·FR-013 이 격자 모델로 개정되면서 본문을 재작성했다.
> **원안 전문은 [spec.md 롤백 기록](spec.md) 절에 보존돼 있다** — 되돌리면 그대로 다시 쓴다.
>
> | 절 | 상태 |
> |---|---|
> | Summary·Technical Context Constraints | ✅ 개정됨 |
> | 보류 항목 B2 | ✅ 개정됨 |
> | 처리 흐름 (전 단계) | ✅ **2026-09-11 재작성** — D16~D19 반영 |
> | 조회·인덱스 및 성능 설계 | ✅ **2026-09-11 재작성** — data 실측 인덱스·질의·함정으로 교체 |
> | Source Code 표 | ✅ **2026-09-11 갱신** — `MajorTrackReader` 시그니처. `MajorSelection` 롤백 자산 표기는 2026-09-12 삭제로 대체됐다 |
>
> **D16~D19 확정 후 재작성 완료(2026-09-11).** 본문은 이제 격자 모델 기준이다.
> 원안 전문은 spec 의 롤백 기록 절에만 남아 있다.
>
> 롤백 조건과 원안 전문은 [spec.md "대체된 요구사항 — 롤백 기록"](spec.md) 절에 있다.

## Summary

⟲ *D15 개정*: 현재 레벨 n을 PC(2n-1)·PC(2n)으로 해석하고, 해당 평면을 **격자로 나눈 구역**의 대표곡을 반환한다.
1레이어는 미리 계산한 정적 결과, 2레이어 이후는 **전달받은 누적 축 범위**로 실시간 산정이다.
격자는 화면 픽셀 기준이라 **서버가 적용하지 않고**(D16), 서버는 상주 집합을 공간 균등하게 반환한다.
인기순 대표 선별은 클라이언트 몫이다. 응답은 FE `MapPoint` 형태다(D18).

*원안*: 현재 레벨 n을 PC(2n-1)·PC(2n)으로 해석하고, 서버의 레벨별 반경을 적용한 이동 원형 영역에서
기존 탐색 제약을 만족하는 곡을 youtubeCnt 내림차순 상위 k개로 반환한다.
playCnt는 동결 메타데이터이며 순위에 사용하지 않는다. 고정 그리드·모델 재학습·근사 후보 누락은 도입하지 않는다.

기존 MVC → MusicService → 데이터 조회 경계를 유지한다. 데이터 조회는 `MajorTrackReader` port 로 분리한다.
DB·스키마·인덱스는 data 트랙이 확정했으므로(스펙 16·18) SQL 제품·드라이버를 새로 정하지 않는다.
잔여 미정은 아래 보류 항목으로 추적한다.

## Technical Context

**Language/Version**: Java 17 (`build.gradle`, Dockerfile).
**Primary Dependencies**: 저장소 선언 기준 Spring Boot 4.1.1, dependency-management 1.1.7,
webmvc, validation, actuator, Prometheus registry. 이번 작업에서 의존성 해석·빌드는 실행하지 않음.
**Build**: Gradle wrapper 9.7.1 선언. 실제 다운로드·실행 및 JDK 호환성 확인은 검증 전제다.
**Storage**: PostgreSQL 17.11 + pgvector 0.7.0. `music` 662만행 적재 완료(`location vector(16)`, `id` 1..6,624,399).
인덱스 `music_l1_gist`·`music_l2_gist`(표현식 GiST)·`music_location_hnsw_idx`. 접근은 MyBatis mapper.
Neo4j 는 곡–장르 관계용이며 좌표 검색에 쓰지 않는다(data D9).
**Testing**: 기존 JUnit Platform, MVC test, MockitoBean 활용. 실 저장소 통합 검증은 적재 완료로 **지금 구성 가능**(실 postgres fixture).
**Target Platform**: 현재 Dockerfile의 Java17 Linux 컨테이너, HTTP 8080. 로컬 PowerShell 실행 가능.
**Project Type**: 단일 Gradle Spring MVC backend. 별도 프론트·데이터 서비스 코드는 이 체크아웃에서 확인되지 않음.
**Performance Goals**: requirements §6 지도 조회·렌더링 전체 2초. API 단독 예산·부하·백분위 목표 미정.
**Constraints** ⟲ *D15*: 격자 구역·1레이어 정적 서빙·고정 PCA16·누적 제약 보존. 미정 정책의 임의 기본값 금지.
전역 상위 k 선절단 금지는 유지한다. *(원안: 원형·서버 반경·youtubeCnt 순위)*
**Scale/Scope**: team-roles §10 기준 v2.1-pca16, 6,624,399곡. 실제 적재 건수·분포·트래픽은 미검증.
상주 집합은 optional `size`(1~10,000)를 모든 레이어의 반환 상한으로 적용한다(A-30).
생략하면 2레이어 이상은 기존 1000곡 상한, 1레이어는 기존 정적 표본 전체를 유지한다.
지도 `MapPoint`는 `youtubeUrl`을 제외하고 PC16을 응답 경계에서 HALF_UP 3자리로 반올림한다(A-31·A-32).

## Constitution Check

| 원칙 | 설계 전 → 설계 후 | 판단 및 근거 |
| --- | --- | --- |
| I 명세 우선 | 보류 → **부분 충족** | 기능 명세는 Draft. 조회 모델은 D15~D19 로 확정, 잔여는 B1·B4·B3(장르). 게이트 독립 범위는 2026-09-10 구현 완료 |
| II 계약 우선 | 보류 → **부분 충족** | 소비자 합의 완료(2026-09-11 FE1), 조회 port 확정(T004). **잔여: 정본 api-spec §3.4 동기화(T036)** — 이게 끝나야 충족 |
| III 완료 전 검증 | 계획 필요 → 설계 충족/실행 미검증 | quickstart에 A1~A14와 검사 구분. 코드 검사 통과 주장 없음 |
| IV 데이터 재현성 | 증거 부족 → **충족** | 스키마·적재 실측 확보(data 스펙 18: 662만행, 좌표 float32 왕복 검사 AC2). 계보는 `coords_v2.parquet` → `music.location` |
| V 좌표 안정성 | 적용 → 설계 충족 | 한 요청에서 한 기준선·정책 버전 고정, 재학습 없음 |
| VI 탐색 일관성 | 연결 공백 → **부분 충족** | PC 단계 누적은 D19 로 성립(클라이언트가 누적 범위 전달, 서버 무상태). 장르 필터 누적은 미정. 전역 후보로 대체하지 않음 |
| VII 실험 격리 | 적용 → 설계 충족 | 실험 인덱스는 별도 평가, 운영 기준선 자동 교체 없음 |
| VIII 관측 | 방법 필요 → 설계 충족/미검증 | 기존 Actuator/Prometheus 활용, 지표·기밀 제외 정의 |
| IX 추정 금지 | 적용 → 설계 충족 | 미정 항목(빈 결과 계약·입력 검증 경계·무장르 인덱스 번호)을 구현 관행으로 결정하지 않음 |
| X 경계 준수 | 업무 경계 존재 → 부분 보류 | BE2 업무 로직/BE4 조회/Core 공통 보존. 내부 port는 설계 제안, 실제 경계 계약 합의 전 |

미해결 게이트를 통과로 표시하지 않는다. 사용자가 명시한 '공백을 표시한 설계 산출물 작성' 범위에서만
조건부 산출물을 제공한다. Phase 0/1 완전 통과나 구현 준비 완료를 의미하지 않으며, 정책 확정 전 의존 구현은 금지한다.

## Project Structure

### Documentation (this feature)

- [research.md](research.md): 기술 선택·대안·증거·보류 조건.
- [data-model.md](data-model.md): 기존 DTO와 조회용 논리 모델·데이터 계보.
- [contracts/music-major.md](contracts/music-major.md): 확인된 API와 미정 계약, BE4 경계 제안.
- [quickstart.md](quickstart.md): 후속 구현 검증 절차·수용 시나리오·성능·관측.
- spec.md와 checklists/requirements.md는 이번 계획에서 변경하지 않는다. tasks.md 생성 없음.

### Source Code (repository root)

기존 루트는 `backend/src/main/java/com/ssafy/backend/` 다(2026-09-10 재배치, S15P21A405-115).
아래 표의 `MajorQueryResolver`·`MajorSelection` 은 구현됐다가 **2026-09-12 삭제**됐다(S15P21A405-236). 나머지는 설계 제안이다.

| 위치 | 재사용·변경 설계 | 책임 |
| --- | --- | --- |
| music/controller/MusicController.java | 기존 GET·필드명 유지. 입력 DTO 바인딩으로 정리 가능 | HTTP 타입 해석·공통 응답, 업무 선정 로직 없음 |
| music/service/MusicService.java | getMajor의 미구현 예외를 orchestration으로 교체 | 정책 조회 → 조건 변환 → 조회 호출 → 응답 조립 |
| music/dto/MajorResponse.java, MusicDetail.java, Location.java | 우선 재사용, 타입·null 계약 검증 후 필요한 변경만 | wire 모델. 내부 조회 모델과 구분 |
| ~~music/service/MajorQueryResolver.java~~ **(2026-09-12 삭제)** | 레벨-축 추출. D19 로 `MajorQuery.axisX()`·`axisY()` 가 대체했다 | 복원 지점: tasks.md "삭제한 롤백 자산" |
| ~~music/service/MajorSelection.java~~ **(2026-09-12 삭제)** | 후보에 `youtubeCnt` DESC top-k. D16 으로 서버 요구에서 빠졌고 `youtube_cnt` 는 전 행 0 이다 | 복원 지점: tasks.md "삭제한 롤백 자산" |
| music/service/MajorSelectionPolicy.java (제안) ⟲*D16* | ~~서버 반경·k~~ → 상주 집합 크기·공간 균등 샘플링 파라미터 | 화면 격자 로직은 서버에 두지 않는다 |
| music/retrieval/MajorTrackReader.java (제안) ⟲*D19* | 조회 port. ~~원형·top-k 계약~~ → **`(level, 누적 축 범위[], 크기)` → 상주 집합** | 1겹 `map_sample` 정적 / 2겹 이상 `<@ box` + `BETWEEN`. 무상태 |
| music/retrieval/하위 어댑터 | **MyBatis mapper XML** (`classpath:mapper/**/*.xml`) + PostgreSQL | 1겹 `map_sample`, 2겹 이상 GiST + `BETWEEN`. 새 독립 검색엔진 생성 아님 |
| common/response, common/exception | ApiResponse·BusinessException·기존 handler 재사용 | BE1 공통 소유. 교체/확장 시 협의 |
| src/test/java/com/ssafy/backend/music/ | 기존 MVC 테스트 유지·확장, 순수 조건 및 실데이터 통합 검증 추가 예정 | 선정 의미와 외부 계약 검증 |
| build.gradle, application.yml | 기본 변경 없음. MyBatis·postgres 는 master 에 이미 있다 | 임의 ORM·캐시·보안 프레임워크 신규 채택 금지 |

**Structure Decision**: 기존 music/common 패키지를 유지하고, 서비스 내부 조건 변환과 BE4 I/O를 분리한다.
Core 인증·공통 체계가 들어오면 재사용한다. 현재 예외 처리 주석의 임시 공통 계층을 임의 삭제하지 않는다.

## 처리 흐름

1. Core 인증 경계에서 Bearer를 검증한다. 2026-09-10 기준 `SecurityConfig` 가 기본 거부라
   `/music/**` 에 인증이 걸린다(dev `c820b53`). 만료/위조 구분만 B5 잔여다.
2. MVC가 `level`과 **누적 축 범위**를 바인딩한다(D19). 타입 오류는 기존 handler의 400을 재사용한다.
   범위 파라미터 이름은 FE 구현 시 확정(BE2 제안 `pc{n}min`·`pc{n}max`).
   축 번호 범위·`min > max`·비유한 수·level 범위 검증은 B1 결정 후 검증기에 반영한다.
3. 한 요청의 서빙 기준선을 고정한다. `music.location vector(16)` 662만행(data 스펙 18)이 유일 소스다.
4. n→축 번호 2n-1, 2n을 계산한다(FR-003, `MajorQuery.axisX()`·`axisY()`).
   **level=1 은 파라미터 없는 정적 분기**로 `map_sample` 을 읽는다(D19). 중심을 (0,0)이나 전체 영역으로 대체하지 않는다.
5. level≥2 는 전달받은 **누적 축 범위를 그대로** 필터로 쓴다(D19). 서버가 범위를 만들어내지 않으며
   탐색 상태도 보관하지 않는다. 범위를 못 받으면 전역 후보로 축소 구현하지 않는다.
   장르 필터 누적은 FE1 답변에 없어 미정으로 남는다(B3 잔여).
6. 1겹 범위는 표현식 GiST(`point((location::real[])[1],[2]) <@ box(...)`)로,
   **2겹부터는 `BETWEEN` heap 필터**로 건다. 둘 다 GiST 로 묶으면 플래너가 `BitmapAnd` 로
   145 ms → 355 ms 로 느려진다(data 실측). 응답 PC 좌표는 저장된 고정값을 그대로 유지한다.
7. 상주 집합을 **공간적으로 고르게** 뽑는다(FR-013). 인기순 상위 k 선별은 서버가 하지 않는다(D16) —
   클라이언트가 화면 격자에서 한다. 전역 선절단 후 범위 필터는 금지한다(MUST NOT).
8. 응답 항목을 `MapPoint` 형태로 조립한다(D18):
   `musicId`·`pc[16]`·`genreId`·`weight`·`title`·`artist`·`playable`.
   `weight` 는 현재 0/균일(D17), `playable` 은 `youtube_url` 전 행 NULL 이라 현재 전부 false.
   `genreId` 는 비음수여야 한다 — FE `draw-map.ts` 가 raw modulo 라 음수면 예외.
9. ApiResponse.ok로 반환한다. 예외는 기존 공통 오류로 매핑하고 데이터 장애를 빈 성공으로 바꾸지 않는다.
   후보 0곡의 정상 상태·본문은 B4 확정 전 구현하지 않는다. 지연·오류·반환 수 지표를 기록한다.

## 조회·인덱스 및 성능 설계

⟲ *2026-09-11 D15~D19 로 재작성.* 후보 탐색은 끝났다 — **data 가 인덱스를 이미 만들고 실측했다**
(스펙 16, `ingest/map_layer_queries.sql`, `output/map_layer_bench_2026-09-11.json`). 그 형태를 그대로 쓴다.

기준 의미는 **"누적 축 범위 안의 상주 집합을 공간 균등하게"** 다. 인기순 top-k 는 서버가 하지 않는다(D16).
전역 인기 목록을 먼저 materialize 한 뒤 필터하지 않는다(MUST NOT, 원안에서 유지).

| 경로 | 질의 | 실측 |
|---|---|---|
| 1겹 첫 화면 | `SELECT ... FROM map_sample WHERE layer = 1` | **0.4 ms** (1,094행, 120 kB) |
| 2겹 | `point((location::real[])[1],[2]) <@ box(...)` + `LIMIT` | **82 ms** (후보 241,605) |
| 3겹 이후 | 위 + `(location::real[])[3] BETWEEN ...` heap 필터 | **145 ms** |
| 평면 최근접 | `ORDER BY point(...) <-> point(x,y)` KNN GiST | 0.24 ms |
| 16차원 이웃 | `location <-> :qvec`, HNSW | 13.9 ms |

**함정 셋** — data 가 실측으로 확인했다. 어댑터에서 그대로 피한다.

1. **`<@ box` 를 두 번 쓰지 않는다.** 플래너가 `BitmapAnd` 로 묶어 145 → **355 ms** 로 느려진다.
   선택도 높은 1겹 인덱스 하나 + heap 필터가 2.4배 빠르다.
2. **질의 벡터를 서브쿼리로 넘기지 않는다.** `InitPlan` 으로 들어가 HNSW 가 값을 못 쓴다 —
   recall 0.9995 → **0.0000**. 좌표를 먼저 읽어 바인드 파라미터로 넘긴다.
3. **pgvector 0.7.0 은 필터 걸린 검색에서 `LIMIT` 보다 적게 반환한다.** iterative index scan 이 없다.
   부분 인덱스 → `hnsw.ef_search` 상향 → 0.8.0 버전 상향 순으로 대응한다.

인덱스는 `music_l1_gist`·`music_l2_gist`(각 421 MB, 빌드 21초)와 `music_location_hnsw_idx` 가 이미 있다.
3겹 이후 평면 인덱스는 필요해지면 21초에 추가한다(data 스펙 16 비범위).

남은 위험은 상주 집합 1000곡의 **PC16 전송량·직렬화 비용**과 `map_sample` 에 없는 필드
(`pc[16]`·`genreId`·`weight`)를 채우려 `music` 조인이 필요할 때의 **0.4 ms 이점 상실**이다 — 어댑터 구현 시 재측정한다.
약 662만 곡 전부를 JVM 에 적재하지 않는다. 공유 캐시는 초기 설계에서 제외한다.

## 보류 항목과 진행 조건

| ID | 미결정 / 필요한 확인 | 의존 구간 |
| --- | --- | --- |
| B1 | spec P1: 지원 레벨, level 생략, 추가/누락 PC, 수치 유효성 | 요청 검증·오류 인수 기준 |
| ~~B2~~ ✅*D16·D19* | **해소.** 격자 단위=화면 픽셀(서버 미적용), 영역 파라미터=GET 누적 축 범위, 상주 집합이 곧 응답, 선정은 서버 공간 균등/클라이언트 인기순. level1 = `map_sample` | — |
| B3 ⟲*D19* | PC 단계 누적은 **해소**(클라이언트가 누적 범위를 캐싱해 전달, 서버 무상태). **잔여: 장르 필터 누적** — FE1 답변에 없다 | 장르 후보 제약 |
| B4 | k 확정, 동률·null·중복·부족/빈 결과·페이지 계약·조회수 갱신 일관성 | 정렬·응답 및 정확한 기대값 |
| B5 | ~~Core 인증 연동~~(2026-09-10 해소: dev `c820b53` 기본 거부 전환), ~~토큰 없음 코드~~(해소: `AuthErrorCode.UNAUTHENTICATED`). **잔여**: 만료 코드 `TOKEN_EXPIRED` 부재, DTO의 genres/null/정수 표현 범위 | 만료 인수 기준·역직렬화·데이터 표현 |
| ~~B6~~ ✅ | **해소.** `music` 662만행 적재 완료(`location vector(16)`, `id` 1..6,624,399), GiST·HNSW 인덱스 구축, 조회 계약 문서화(data `map_layer_queries.sql`) | — |

C1/C4 레벨 표현은 clarification으로 해소됐으나 원본 동기화가 필요하고,
C2 페이지·C3 생략 규칙은 미해결이다. docs/api-spec.md §0.6·§3.4 및 requirements §1.3·MAP-04의
필요 변경은 spec의 원본 동기화 절을 따른다. 이 계획은 원본을 수정하지 않는다.
잔여 B1·B4 는 제품/공개 계약 합의, B3 잔여(장르 필터)는 FE1 확인, B5 잔여(만료 코드)는 BE1 합의다. B2·B6 는 해소됐다.
새 아키텍처나 경계 변경이 필요하면 관련 팀 합의 후 ADR을 기록한다. research의 제안 자체는 승인 ADR이 아니다.

## Complexity Tracking

추가 서비스·DB·ORM·캐시를 확정하지 않는다. 미해결 게이트를 예외로 면제하지 않는다.
본 조건부 설계는 요청된 산출물이며, **종단** 구현 착수 전에 위 보류 항목과 계약 검토를 완료해야 한다.
게이트 독립 순수 로직은 예외로 선행했다(tasks T007~T012·T023).
