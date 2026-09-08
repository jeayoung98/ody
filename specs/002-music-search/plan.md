# Implementation Plan: 음악 검색

**Branch**: `002-music-search` | **Date**: 2026-09-08 | **Spec**: [spec.md](spec.md)

**Input**: spec.md (clarify 완료: 매칭=substring 대소문자 무시, 정렬=youtubeCnt DESC·id ASC)

**Status**: 조건부 설계. 검색 고유 정책은 확정됐고, 공유 인프라(인증·저장소/BE4) 2건에 구현이 게이트됨.

## Summary

`GET /music/search`에서 `query`를 곡명·아티스트명에 대소문자 무시 부분일치(substring)로 매칭하고,
youtubeCnt 내림차순·id 오름차순으로 정렬하여 서버 고정 10건 페이지로 반환한다.
좌표는 baseline `v2.1-pca16` 고정값을 그대로 싣는다.

기존 MVC → MusicService → 조회 port 경계를 유지한다. 텍스트 검색의 **인덱스·쿼리 실행은 BE4 조회 port**
뒤로 분리하고(헌법 X), **API·입력검증·응답조립·매칭/정렬 계약은 BE2**가 소유한다. 001의 MajorTrackReader
분리와 동일 패턴이라 새 경계를 발명하지 않는다.

## Technical Context

**Language/Version**: Java 17 (`build.gradle`).
**Primary Dependencies**: Spring Boot 4.1.1 (webmvc, validation, actuator), micrometer-registry-prometheus.
**Storage**: **NEEDS CLARIFICATION (B-D)** — DB 의존성·datasource·엔티티·리포지토리 전무. 서빙 baseline은
Postgres/pgvector로 추정(team memory)되나 build.gradle에 드라이버 없음. 곡 데이터·검색 인터페이스는 BE4 제공.
**Testing**: JUnit Platform + webmvc-test(MockMvc) + MockitoBean. 순수 검증·컨트롤러 슬라이스는 지금 작성 가능,
실데이터 통합은 B-D 후.
**Target Platform**: Java17 Linux 컨테이너, HTTP 8080.
**Project Type**: 단일 Gradle Spring MVC backend.
**Performance Goals**: 제안 p95 < 300ms(팀 확인 대상). 요구사항 §6 "유사곡 검색 1초"는 좌표 검색 대상이라 전용 안 함.
**Constraints**: substring 대소문자 무시 매칭, youtubeCnt DESC·id ASC, 페이지 10 고정, 고정 좌표 보존, 재생불가 곡 유지.
**Scale/Scope**: baseline v2.1-pca16 6,624,399곡(team-roles §10). 실제 적재·분포·트래픽 미검증.

## Constitution Check

*GATE: Phase 0 전 통과 필요. Phase 1 후 재확인.*

| 원칙 | 판단 | 근거 |
| --- | --- | --- |
| I 명세 우선 | 충족(설계) / 구현 게이트 | spec clarify 완료. 구현은 B-A·B-D 의존 |
| II 계약 우선 | 부분 | api-spec §3.1 기존 계약 유지. BE4 검색 port 계약은 합의 필요 |
| III 완료 전 검증 | 설계 충족 / 실행 미검증 | quickstart에 A1~A4·US2 검사 정의. 코드 통과 주장 없음 |
| IV 데이터 재현성 | N/A | 검색 조회는 데이터 산출물 생성 없음 |
| V 좌표 안정성 | 충족 | 응답은 고정 좌표 그대로. 검색이 좌표·모델 변경 없음 |
| VI 탐색 일관성 | N/A | 텍스트 검색은 계층 탐색·조건 누적 아님. 결과 선택 후 지도 이동은 FE 상태(범위 밖) |
| VII 실험 격리 | N/A | 실험 인덱스·모델 도입 없음 |
| VIII 관측 | 설계 충족 / 미검증 | actuator+micrometer의 http.server.requests 재사용 + 실패 로그(PII 제외) |
| IX 추정 금지 | 충족 | 매칭·정렬 clarify 확정. 경계는 기존 패턴 준용. perf·인덱스는 발명 않고 이월 |
| X 경계 | 설계 제안 / 합의 전 | BE2 API·규칙 / BE4 인덱스·실행 분리. port 계약 BE4 합의 필요 |

미해결 게이트를 통과로 표시하지 않는다. B-A·B-D 확정 전 의존 구현은 금지한다.

## Project Structure

### Documentation (this feature)

- [research.md](research.md): 경계(X)·관측(VIII)·인덱스·성능 결정과 대안.
- [data-model.md](data-model.md): MusicSummary·페이지 응답·검색 요청 논리 모델.
- [contracts/music-search.md](contracts/music-search.md): 확정 API + BE4 검색 port 계약.
- [quickstart.md](quickstart.md): A1~A4·US2 검증 절차.

### Source Code (repository root)

기존 루트 `src/main/java/com/ssafy/backend/`. 아래는 설계 제안이며 파일 미생성.

| 위치 | 설계 | 책임 |
| --- | --- | --- |
| music/controller/MusicController.java | `GET /music/search` 핸들러 추가. `@Validated`, `@RequestParam query`(@NotBlank), `page`(@Min 0) | HTTP 바인딩·검증, 업무 로직 없음 |
| music/dto/MusicSummary.java (신규) | id,title,artist,album,genres,youtubeUrl,location record | 검색 결과 wire 모델(§0.6) |
| music/dto/PageResponse.java (신규) | content + page,size,totalElements,totalPages,hasNext | 목록 페이지 래퍼(§0.3). 다른 목록 API도 재사용 |
| music/service/MusicService.java | `search(query, page)` 추가 → port 호출·응답 조립 | orchestration |
| music/search/MusicSearchReader.java (신규 port) | `search(query, page, size)` → 페이지 결과 | BE4 합의 조회 계약: substring·정렬·페이징 실행 |
| music/search/ 어댑터 (B-D 후) | Postgres 등 실제 구현 | 인덱스·쿼리 실행 |
| common/response, common/exception | ApiResponse·GlobalExceptionHandler 재사용 | BE1 공통(교체 시 협의) |
| common/exception/ErrorCode.java | `INVALID_TOKEN`·`TOKEN_EXPIRED` 추가(인증 연동 시) | 현재 미등록 |
| src/test/java/.../music/ | 컨트롤러 슬라이스(검증·에러)·port mock 테스트 | 계약 검증 |

**Structure Decision**: 기존 music/common 패키지 유지. 검색 실행을 `music/search` port로 분리(헌법 X).
페이지 래퍼는 재사용 가능하게 공통 위치(dto)에 둠 — 향후 user/search·playlist 등 목록 API 공유.

## 처리 흐름

1. Core 인증 경계에서 Bearer 검증 (B-A: 현재 인증 미구현, 통합은 Core 도착 후).
2. MVC가 `query`·`page` 바인딩. `@NotBlank`(공백·빈값 거절)·`@Min(0)`. 위반 시 기존 handler 400 VALIDATION_ERROR.
3. MusicService.search가 port에 `(query.trim(), page, size=10)` 위임.
4. port는 곡명 OR 아티스트명 ILIKE 부분일치 후보를 youtubeCnt DESC·id ASC 정렬, page*10 offset에서 10건 + 총계 반환.
5. MusicSummary로 조립(좌표 고정값 그대로, youtubeUrl null 유지), PageResponse에 담아 ApiResponse.ok.
6. 매칭 0건 → 빈 content + 200. 예외 → 기존 공통 오류 매핑(데이터 장애를 빈 성공으로 바꾸지 않음).
7. http.server.requests(actuator)로 지연·오류율·요청량 관측. 실패는 구조화 로그(PII·query 원문 과다 노출 주의).

## 조회·인덱스 및 성능 설계 (B-D 후 확정)

기준 의미: `(title ILIKE %q% OR artist ILIKE %q%)` 필터 → youtubeCnt DESC, id ASC → offset/limit 10.

- **substring(양끝 wildcard) ILIKE는 B-tree 인덱스 불가.** Postgres라면 `pg_trgm` GIN 인덱스가 title/artist에 필요.
  전문검색(tsvector)은 clarify에서 substring으로 확정했으므로 도입 안 함.
- youtubeCnt 정렬 + 662만 곡: 매칭 후보가 클 때 정렬 비용 주의. trgm 필터로 후보를 줄인 뒤 정렬이 일반적.
- offset 페이징은 깊은 page에서 비용 증가하나, 검색 UX상 깊은 페이지 희소 → 초기엔 offset 유지(YAGNI). keyset은 필요 시.
- 캐시는 초기 설계 제외. 도입 시 (query, page, 데이터 revision)을 키에 포함.

실제 DB·드라이버·DDL은 B-D(BE4 인터페이스·스키마) 확정 후. 상세는 research.md.

## 보류 항목과 진행 조건

| ID | 미결정 / 필요한 확인 | 의존 구간 |
| --- | --- | --- |
| B-A | Core 인증 연동, 토큰 없음/만료 코드(INVALID_TOKEN·TOKEN_EXPIRED 미등록), 토큰 subject | 인증 통합·401 인수 기준 |
| B-D | BE4 검색 인터페이스·실제 저장소·스키마·곡 데이터·youtubeCnt 컬럼·pg_trgm 가용성·데이터 분포 | port 어댑터·인덱스·성능 측정 |
| B-Field | genres 다형(list/string/null) 및 null 표현 범위(§0.6 미명시분) | 역직렬화·DTO 타입 확정 |

B-A·B-D는 공유 인프라 의존(검색 고유 아님). 검색 고유 정책 블로커는 clarify로 0건.
새 경계·아키텍처 필요 시 팀 합의 후 ADR. research 제안 자체는 승인 ADR이 아니다.

## Complexity Tracking

신규 의존성 없음(기존 스타터로 충분). 페이지 래퍼 1개·검색 port 1개만 추가.
ORM·캐시·검색엔진 신규 채택 없음. 미해결 게이트(B-A·B-D)를 예외 면제하지 않는다.
