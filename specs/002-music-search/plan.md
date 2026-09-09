# Implementation Plan: 음악 검색

**Branch**: `feat/music-search` | **Date**: 2026-09-09 (master 인프라 재베이스라인) | **Spec**: [spec.md](spec.md)

**Input**: spec.md (2026-09-09 재베이스라인: 에러코드 master 기준, 매칭·정렬 불변)

**Status**: master 통합 후 재설계. B-D 대부분 해소(Postgres·MyBatis in), **B-A(인증) 여전히 블로커**.

## Summary

`GET /music/search`에서 곡명·아티스트명 substring(대소문자 무시) 매칭, youtubeCnt DESC·id ASC,
서버 고정 10건 페이지 반환. 좌표는 baseline `v2.1-pca16` 고정값 그대로.

master 공통 레이어(`common.ApiResponse.success`, `GlobalErrorCode`, `CustomException`, `GlobalExceptionHandler`)
위에서 동작한다. 검색 실행은 **MyBatis 매퍼**(`MusicSearchReader` port의 어댑터)로 분리(헌법 X: BE2 계약 / BE4 실행).

## Technical Context

**Language/Version**: Java 17 (`backend/build.gradle`).
**Primary Dependencies**: Spring Boot 4.1.1 (webmvc, validation, actuator), **MyBatis**(mybatis-spring-boot-starter), spring-boot-starter-jdbc, micrometer-prometheus, lombok, dotenv. (Neo4j·Redis·websocket도 스택에 있으나 텍스트 검색엔 미사용.)
**Storage**: **Postgres**(org.postgresql, HikariCP, `application-db.yml`). 검색 대상 곡 데이터가 Postgres인지 Neo4j인지, `title/artist/youtubeCnt` 스키마·`pc1~pc16` 저장 형태는 **B-D(BE4 확인)**. `application-db.yml`은 env(SPRING_DATASOURCE_*) 주입, `sql.init.mode: never`(스키마 외부 관리).
**Testing**: JUnit Platform, H2(test), MockMvc. ⚠️ `@WebMvcTest`는 master `@MapperScan`과 충돌(아래 R2) → standalone MockMvc 채택.
**Target Platform**: Java17 컨테이너(backend/Dockerfile), HTTP 8080.
**Project Type**: 단일 Gradle backend (`backend/`).
**Performance Goals**: 제안 p95 < 300ms(팀 확인). §6 "유사곡 1초"는 좌표 검색용이라 전용 안 함.
**Constraints**: substring 대소문자 무시, youtubeCnt DESC·id ASC, 페이지 10 고정, 고정 좌표, 재생불가 곡 유지, 공통 레이어(GlobalErrorCode) 준수.
**Scale/Scope**: baseline v2.1-pca16 6,624,399곡. 실제 적재·트래픽 미검증.

## Constitution Check

| 원칙 | 판단 | 근거 |
| --- | --- | --- |
| I 명세 우선 | 충족 | spec 재베이스라인 완료. 구현은 B-A 잔여 |
| II 계약 우선 | 부분 | master 공통 계약 채택. api-spec §0.5 에러코드 불일치는 spec [충돌]로 기록, 정본 갱신 대상 |
| III 완료 전 검증 | 설계 충족 | quickstart 시나리오, standalone MockMvc·유닛으로 검증 |
| IV 데이터 재현성 | N/A | 검색 조회는 데이터 산출물 생성 없음 |
| V 좌표 안정성 | 충족 | 응답은 고정 좌표 그대로 |
| VI 탐색 일관성 | N/A | 텍스트 검색은 계층 탐색 아님 |
| VII 실험 격리 | N/A | — |
| VIII 관측 | 설계 충족 | actuator `http.server.requests` + 실패 로그(master handler에 이미 log.error). PII 미노출 |
| IX 추정 금지 | 충족 | 에러코드·저장소 미확정을 임의 확정 안 함. 정본 불일치·저장소는 명시 |
| X 경계 | 설계 | BE2 API·규칙 / BE4 인덱스·실행(MyBatis 매퍼 = port 어댑터) |

B-A(인증)·B-D(저장소 확정) 미해결 게이트를 통과로 표시하지 않는다.

## Project Structure

### Documentation

- [research.md](research.md): 저장소·MyBatis·테스트 인프라·검증매핑·인덱스 결정.
- [data-model.md](data-model.md): MusicSummary·PageResponse·검색요청, MyBatis 매핑.
- [contracts/music-search.md](contracts/music-search.md): API + port + master 공통 계약.
- [quickstart.md](quickstart.md): 검증 시나리오(standalone MockMvc·유닛).

### Source (backend/, master 구조)

| 위치 | 설계 | 상태 |
| --- | --- | --- |
| `backend/.../music/controller/MusicController.java` | GET /music/search 핸들러(@NotBlank/@Min) | 이전됨, ApiResponse.success 재배선 완료 |
| `backend/.../music/dto/{MusicSummary,PageResponse,...}` | 검색 DTO | 이전됨 |
| `backend/.../music/service/MusicService.java` | search 오케스트레이션(Optional<port>) | 이전됨 |
| `backend/.../music/search/MusicSearchReader.java` | 조회 port | 이전됨 |
| `backend/.../music/search/MusicSearchMapper.java` (신규) | **MyBatis 매퍼 = port 어댑터** | B-D 후 구현(T203) |
| `backend/.../music/search/MusicSearchMapper.xml` 또는 애노테이션 | substring·정렬·페이징 SQL | B-D 후 |
| `backend/.../common/*` | master 공통 레이어 재사용 | 손대지 않음(BE1) |
| `backend/.../common/GlobalExceptionHandler.java` | 검증 예외→400 매핑 **추가 필요**(R5) | BE1 합의 |
| `backend/src/test/.../music/*` | standalone MockMvc + 유닛 | R2 반영 재작성 필요 |

**Structure Decision**: master `backend/` 구조·공통 레이어 채택. 검색 실행은 `music/search` port + MyBatis 어댑터.
검색 전용 공통 클래스 신규 생성 없음(BE1 재사용).

## 처리 흐름

1. (B-A) Core 인증 경계에서 Bearer 검증 — 미구현, 통합 대기.
2. MVC가 `query`·`page` 바인딩(@NotBlank/@Min). 검증 위반 → GlobalExceptionHandler(검증 매핑 추가 후) 400 INVALID_INPUT.
3. MusicService.search → port.search(query.trim(), page, 10).
4. MyBatis 매퍼: `title ILIKE %q% OR artist ILIKE %q%` → youtubeCnt DESC, id ASC → offset page*10 limit 10 + count.
5. MusicSummary 조립(좌표 그대로, youtubeUrl null 유지) → PageResponse → ApiResponse.success.
6. 매칭 0건 → 빈 content + 200. 예외 → GlobalExceptionHandler 500 INTERNAL_SERVER_ERROR(이미 log.error).
7. 관측: actuator http.server.requests.

## 보류 항목

| ID | 내용 | 의존 |
| --- | --- | --- |
| B-A | Core 인증·401 코드(GlobalErrorCode에 없음)·토큰 subject | 인증 통합·E4 |
| B-D | 검색 대상 저장소(Postgres/Neo4j)·곡 스키마·youtubeCnt 컬럼·pg_trgm 가용성 | 매퍼 SQL·인덱스·실데이터 테스트 |
| B-Common | 검증 예외→400 매핑을 공통 GlobalExceptionHandler에 추가(BE1 소유) | E1/E2 통과·전 엔드포인트 이득 |

## Complexity Tracking

신규 의존성 없음(master 스택으로 충분). 추가 = MyBatis 매퍼 1개(어댑터) + 검증 예외 매핑.
검색 전용 공통·ORM·캐시 신규 없음. 미해결 게이트(B-A/B-D/B-Common) 면제 안 함.
