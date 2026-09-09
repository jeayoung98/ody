# Implementation Plan: 노래 상세 조회 (Nearby 포함)

**Branch**: `003-music-detail` | **Date**: 2026-09-09 | **Spec**: [spec.md](spec.md)

**Input**: spec.md (master 인프라 기준, 002-music-search와 동일 공통 레이어)

**Status**: 설계 완료. **B-A(인증)·B-D(저장소·KNN 실행) 블로커**, `MUSIC_NOT_FOUND`(404)는 BE2 도메인 에러로 정의(비블로커).

## Summary

`GET /music/detail?id=`에서 곡 상세(MusicDetail)와 임베딩 공간 최근접 10곡(neighbors, distance 포함)을
한 응답으로 반환한다. 좌표·distance는 baseline `v2.1-pca16` 기준. 곡 없음 → 404 `MUSIC_NOT_FOUND`.

master 공통 레이어(`common.ApiResponse.success`, `GlobalErrorCode`, `CustomException`, `GlobalExceptionHandler`)
위에서 동작한다. 곡 조회·KNN 실행은 **MyBatis 어댑터**(`MusicDetailReader` port)로 분리(헌법 X: BE2 계약 / BE4 실행).

## Technical Context

**Language/Version**: Java 17 (`backend/build.gradle`).
**Primary Dependencies**: Spring Boot 4.1.1 (webmvc, validation, actuator), MyBatis, spring-boot-starter-jdbc, micrometer-prometheus, lombok, dotenv, Jackson(`@JsonUnwrapped` 사용).
**Storage**: Postgres. 곡 상세(`mbid/bpm/duration/playCnt/youtubeCnt/pc1~pc16`) 스키마와 **KNN 실행 방식**(pgvector 미프로비저닝 여부 포함)은 **B-D(BE4 확인)**.
**Testing**: JUnit Platform, MockMvc(standalone). `@WebMvcTest`↔master `@MapperScan` 충돌은 002와 동일하게 standalone MockMvc로 회피(R-T).
**Target Platform**: Java17 컨테이너(backend/Dockerfile), HTTP 8080.
**Project Type**: 단일 Gradle backend (`backend/`).
**Performance Goals**: §6 "유사곡 검색 응답 1초"를 Nearby(주변곡) 응답 예산으로 매핑(팀 확인). 백분위·측정 환경 미정.
**Constraints**: neighbors 10·자기 제외·distance ASC·id ASC, 재생 불가 곡 유지, 고정 좌표, 없는 곡 404, 공통 레이어 준수.
**Scale/Scope**: baseline v2.1-pca16 6,624,399곡. KNN 실 성능 미검증.

## Constitution Check

| 원칙 | 판단 | 근거 |
| --- | --- | --- |
| I 명세 우선 | 충족 | spec 승인 후 구현. B-A 잔여 |
| II 계약 우선 | 부분 | master 공통 계약 채택. `MUSIC_NOT_FOUND`는 BE2 도메인 에러로 정본 §0.5와 정합화 |
| III 완료 전 검증 | 설계 충족 | quickstart 시나리오 + standalone MockMvc·서비스 유닛 |
| IV 데이터 재현성 | N/A | 조회는 데이터 산출물 생성 없음 |
| V 좌표 안정성 | 충족 | 상세·주변곡 좌표는 baseline 고정값 그대로, 재학습 없음 |
| VI 탐색 일관성 | 충족 | neighbors 결정성(distance ASC·id ASC) 명시 |
| VII 실험 격리 | N/A | — |
| VIII 관측 | 설계 충족 | actuator `http.server.requests` + 실패 로그(master handler log.error). 404/500 구분. PII 미노출 |
| IX 추정 금지 | 충족 | 거리 계산식·저장소 임의 확정 안 함(B-D). tie-break만 결정성용 잠정 결정으로 명시 |
| X 경계 | 설계 | BE2 상세·주변곡 규칙/응답 / BE4 곡 조회·KNN 실행(MyBatis 어댑터 = port) |

B-A(인증)·B-D(저장소·KNN 실행) 미해결 게이트를 통과로 표시하지 않는다.

## Project Structure

### Documentation

- [research.md](research.md): 응답 표현(@JsonUnwrapped)·KNN 실행 위임·404 도메인 에러·테스트 인프라 결정.
- [data-model.md](data-model.md): MusicDetailResponse·NeighborTrack·상세 요청, port 매핑.
- [contracts/music-detail.md](contracts/music-detail.md): API + port + master 공통 계약.
- [quickstart.md](quickstart.md): 검증 시나리오(standalone MockMvc·서비스 유닛).

### Source (backend/, master 구조)

| 위치 | 설계 | 상태 |
| --- | --- | --- |
| `backend/.../music/controller/MusicController.java` | `GET /music/detail` 핸들러 추가(@Min(1) long id) | 기존 파일에 메서드 추가 |
| `backend/.../music/dto/MusicDetail.java` | 상세 필드 record | 존재, 재사용 |
| `backend/.../music/dto/MusicSummary.java` | 주변곡 기본 필드 | 존재, 재사용 |
| `backend/.../music/dto/MusicDetailResponse.java` (신규) | `@JsonUnwrapped MusicDetail` + `List<NeighborTrack>` | 신규 |
| `backend/.../music/dto/NeighborTrack.java` (신규) | `@JsonUnwrapped MusicSummary` + `double distance` | 신규 |
| `backend/.../music/detail/MusicDetailReader.java` (신규) | 조회 port(findDetail, findNeighbors) | 신규(계약) |
| `backend/.../music/detail/MusicDetailMapper.java`(신규) | **MyBatis 어댑터 = port 구현** | B-D 후 구현 |
| `backend/.../music/service/MusicService.java` | `getDetail(id)` 오케스트레이션(Optional<port>) | 기존 파일에 메서드 추가 |
| `backend/.../common/MusicErrorCode.java` (신규) | `MUSIC_NOT_FOUND`(404) 도메인 에러 | 신규(BE2) |
| `backend/.../common/GlobalExceptionHandler.java` | CustomException→ErrorCode 매핑 재사용, 검증 예외→400 매핑 확인 | BE1 소유(R-V) |
| `backend/src/test/.../music/*` | standalone MockMvc + 서비스 유닛 | 신규 |

**Structure Decision**: master `backend/` 구조·공통 레이어 채택. 곡 조회·KNN은 `music/detail` port + MyBatis 어댑터.
상세 전용 공통 클래스 신규 없음. 도메인 에러 `MusicErrorCode`만 BE2가 추가(공통 `ErrorCode` 인터페이스 구현).

## 처리 흐름

1. (B-A) Core 인증 경계에서 Bearer 검증 — 미구현, 통합 대기.
2. MVC가 `id` 바인딩(@Min(1) long). 위반 → GlobalExceptionHandler 400 `INVALID_INPUT`.
3. `MusicService.getDetail(id)` → `reader.findDetail(id)`.
4. 곡 없음(Optional.empty) → `CustomException(MusicErrorCode.MUSIC_NOT_FOUND)` → 404.
5. 곡 있음 → `reader.findNeighbors(id, 10)`(distance ASC·id ASC·자기 제외·재생불가 포함은 어댑터 SQL 책임).
6. `MusicDetailResponse(detail, neighbors)` 조립(@JsonUnwrapped로 flat JSON) → `ApiResponse.success`.
7. 내부 예외 → GlobalExceptionHandler 500 `INTERNAL_SERVER_ERROR`(이미 log.error).
8. 관측: actuator `http.server.requests`(404/500 태그 구분).

## 보류 항목

| ID | 내용 | 의존 |
| --- | --- | --- |
| B-A | Core 인증·401 코드(GlobalErrorCode에 없음)·토큰 subject | 인증 통합·E-Auth |
| B-D | 곡 상세 저장소·스키마·**KNN 실행·거리 계산식·인덱스**(pgvector 미프로비저닝?) | 어댑터 SQL·인덱스·실데이터 테스트 |
| B-Common | 검증 예외→400 매핑을 공통 GlobalExceptionHandler에 추가(BE1 소유, 002와 공유) | 전 엔드포인트 이득 |

**비블로커**: `MUSIC_NOT_FOUND`(404)는 BE2가 `MusicErrorCode`로 정의 → 정본 §0.5 정합. CustomException 매핑은 master 핸들러 재사용.

## Complexity Tracking

신규 의존성 없음(master 스택으로 충분). 추가 = 신규 DTO 2개(`MusicDetailResponse`/`NeighborTrack`, `@JsonUnwrapped`),
port 1개(어댑터는 B-D 후), 도메인 에러 enum 1개. 상세 전용 ORM·캐시·매퍼(어댑터 제외) 신규 없음.
미해결 게이트(B-A/B-D) 면제 안 함.
