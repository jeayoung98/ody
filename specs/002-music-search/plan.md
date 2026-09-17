# Implementation Plan: 음악·아티스트 조건 검색

**Branch**: `backend/feat/S15P21A405-365-music-search-filter` | **Date**: 2026-09-17 | **Spec**: [spec.md](spec.md)
**Input**: 002 명세의 세 검색 경로. **상태**: 설계 완료, 구현·성능 검증 전.
Spec Kit 기능 식별자는 002-music-search이며 실제 Git 브랜치는 위와 같다.

## Summary

기존 GET /api/music/search에 선택적 music·artist 조건을 추가한다. query만 있는 요청은 기존 findPage SQL을 그대로 실행한다. 조건 검색은 같은 매퍼에 findFilteredPage 하나를 추가하고 기존 응답 조립·장르 일괄 조회·페이지네이션을 공유한다. 새 테이블, 컬럼, 라이브러리, 캐시, 아티스트 서비스는 필요 없다.

### 구현 시나리오

음악·아티스트 조건 검색 기능을 추가한다.

요구사항:
- 기존 query 검색의 매칭·정렬·응답을 유지한다.
- artist 단독 또는 music+artist 조건으로 음악 목록을 좁힌다.
- 음악 칩만 남은 중간 상태는 추가 요청 없이 아티스트 입력 안내를 표시한다.

기술 조건:
- 기존 Spring MVC, MyBatis, PostgreSQL과 검색 함수 인덱스를 재사용한다.
- 잘못된 조건은 INVALID_INPUT, 내부 실패는 INTERNAL_SERVER_ERROR로 처리한다.

테스트:
- 기존 검색 회귀, 아티스트 단독, 두 조건 AND·관련성 정렬·다중 페이지.
- 공백·혼합 조건·특수 문자·NULL 아티스트·video_id 제외·타임아웃.
- 동일 데이터와 부하에서 기존 대비 p95 회귀 및 신규 경로 p95 검증.

## Technical Context

**Language/Version**: Java 17; 프론트 TypeScript.
**Primary Dependencies**: Spring Boot 4.1.1, MyBatis starter 4.1.0, JDBC, 기존 React/TanStack Query. 의존성 추가 없음.
**Storage**: PostgreSQL music, music_genre, genre. 검색은 기존 title·artist 문자열 사용.
**Testing**: 기존 JUnit/Mockito/@WebMvcTest 확장. SQL 의미 검증은 별도 PostgreSQL+pgvector 테스트 DB에서 수행.
**Target Platform**: 기존 Spring Boot 서버와 웹 검색바.
**Project Type**: backend API 확장, FE 별도 연동.
**Performance Goals**: 기존 통합 검색 p95 < 이전 p95 × 1.10; 신규 두 경로 각각 p95 ≤ 300ms.
**Constraints**: 10건 페이지, hasNext만 제공, 앞일치, SQL 2초 제한, prepareThreshold=0 유지.
**Scale/Scope**: 코드 주석 기준 약 662만 음악. 실제 검증 데이터 버전·행 수·인덱스는 측정 직전 확인한다.

## Constitution Check

| 원칙 | 설계 전/후 판정과 실행 조건 |
| --- | --- |
| I 명세 우선 | 2026-09-17 사용자 승인된 002의 세 경로 내 확장. 승인 계약을 기준으로 태스크 생성 |
| II 계약 우선 | contracts/music-search.md와 FE 전달 문서 동기화. 릴리스 전 FE 연동 및 공통 API 문서 반영 확인 |
| III 검증 | quickstart에 회귀·실 SQL·성능·인증 게이트 명시. 지금 통과했다고 주장하지 않음 |
| IV 재현성 | 벤치에 데이터 버전, DB/앱 커밋, 인덱스, 부하와 결과 기록 |
| V 좌표 안정성 | 기존 MusicSummary/Location 조립 재사용, 재계산 없음 |
| VI 탐색 일관성 | 조건 변경 시 page=0, 지도 선택 동작 유지 |
| VII 실험 격리 | SQL fixture는 전용 테스트 DB. 운영 데이터 쓰기 없음 |
| VIII 관측 | 기존 HTTP 요청량·지연·오류율 활용, 아래 관측 절차 참조 |
| IX 가정 명시 | API 조합·정렬·중간 UI 상태를 계약에 명시. 인덱스 충분성은 측정 게이트 |
| X 경계 | BE2 요청/규칙, 기존 reader/mapper 실행 경계 유지; 인덱스 변경은 BE4 협의 |

설계 자체의 위반 없음. 현재 SecurityConfig의 anyRequest().permitAll()은 명세의 인증 요구와 기존 불일치다. 이 기능에서 공통 보안을 임의 변경하지 않으며, Core의 인증 복구와 401 확인 전 인증 인수 기준은 미충족으로 남긴다.

## Project Structure

산출물: plan.md, research.md, data-model.md, contracts/music-search.md, quickstart.md, frontend-handoff.md.
기존 tasks.md는 이전 구현 기록이며 이번 확장용 실행 목록이 아니다. 다음 speckit-tasks에서 갱신한다.

| 수정 대상 (backend/src/main 기준) | 최소 변경 |
| --- | --- |
| java/.../music/controller/MusicController.java | 선택적 query/music/artist 수신, 필수 page 유지, 검색 API 설명 정정 |
| java/.../music/search/MusicSearchCondition.java (신규 record 1개) | 허용 조합 검증·trim을 한곳에 모음 |
| java/.../music/service/MusicService.java | 조건 전달, 응답 유지, 검색어 원문 로그 제거 |
| java/.../music/search/MusicSearchReader.java | 기존 port에 조건 객체 전달 |
| java/.../music/search/MusicSearchReaderAdapter.java | 통합/필터 매퍼 분기, lowercase·escapeLike 재사용, 결과 조립 공통 |
| java/.../music/mapper/MusicSearchMapper.java | findFilteredPage 선언 추가 |
| resources/mapper/music/MusicSearchMapper.xml | 신규 필터 SQL 추가, 기존 findPage 보존 |

전략 클래스·팩토리·추가 reader·별도 endpoint를 만들지 않는다. record는 여러 계층에서 반복될 조건 검증을 한 번만 수행하기 위한 값 객체다. 기존 검색 호출자와 mock은 새 조건 객체에 맞춰 함께 갱신한다.

## Phase 0: 조사 결과

[research.md](research.md)에 실제 코드 근거와 대안을 기록했다. 기존 함수 인덱스의 존재·유효성 및 신규 경로의 실행계획은 구현 검증 때 확인한다. 스키마 미확정이나 substring 인덱스 도입 같은 과거 블로커는 현재 계획에 적용하지 않는다.

## Phase 1: 구현 설계

1. 요청 조건과 실패 계약을 먼저 고정하고 컨트롤러 검증을 확장한다.
2. 기존 통합 SQL은 보존하고 adapter에서 조건 유무로 매퍼를 선택한다.
3. 필터 SQL은 아티스트 단독이면 2단계, music도 있으면 4단계로 생성한다. 각 단계는 상호 배타적이며 ID 정렬과 LIMIT을 가진다.
4. 모든 조건을 LIMIT 이전에 적용한다. 통합 검색 상위 10건을 가져와 Java/FE에서 필터링하지 않는다.
5. 기존 장르 일괄 조회, videoId, youtubeUrl, 좌표와 hasNext 조립을 공유한다.
6. FE는 전달 문서대로 칩·요청 직렬화·페이지 응답을 연동한다. FE 소스는 별도 담당 작업으로 둔다.

### SQL 실행과 경계

T=lower(title), A=coalesce(lower(artist), ''), t/a=정규화한 입력, tp/ap=이스케이프한 앞일치 패턴이다.

| 경로 | 상호 배타적 단계 (낮은 번호 먼저) |
| --- | --- |
| 아티스트 | 0: A=a / 1: A LIKE ap AND A<>a |
| 음악+아티스트 | 0: T=t AND A=a / 1: T LIKE tp AND T<>t AND A=a / 2: T=t AND A LIKE ap AND A<>a / 3: T LIKE tp AND T<>t AND A LIKE ap AND A<>a |

각 단계에 video_id IS DISTINCT FROM 'none'을 적용한다. ORDER BY id LIMIT cap, UNION ALL 후 ORDER BY tier,id로 페이지를 선택한다. offset=(long)page*10, fetchSize=11, cap=offset+11. 후보 ID를 고른 다음 기존처럼 music PK로 상세 필드를 조회한다. 매퍼 timeout=2 유지.

아티스트 단독 경로에는 통합 검색용 제목 제외 조건을 복사하지 않는다. 제목도 검색어와 같은 음악 역시 아티스트 조건만 맞으면 포함되어야 한다.

### DB와 성능

테이블·컬럼·데이터 마이그레이션은 없다. 기존 music_title_lower와 music_artist_lower를 먼저 사용한다. 인덱스 사용 가능성과 빠른 응답은 다르다. 흔한 접두어, OFFSET 증가, ID 정렬, 0건 교집합은 비용을 키울 수 있다. BitmapAnd 사용을 전제로 구현하지 않는다.

실행계획과 벤치가 기준을 넘을 때만 BE4와 복합/부분 인덱스를 검토한다. 기존 통합 검색에도 새 인덱스가 플랜 변화를 일으킬 수 있으므로 도입하면 세 경로 모두 다시 측정한다. DDL은 별도 재현 SQL·적용·롤백 계획으로 다룬다.

### 관측과 출시

기존 http.server.requests의 /api/music/search 요청 수, 지연 histogram, 4xx/5xx 비율을 전후 비교한다. 경로별 성능은 벤치의 all/artist/combined 태그로 구분하며 사용자 검색어를 metric label로 넣지 않는다. 검색 로그에는 모드·page·반환 개수만 남긴다. 오류 로그에도 토큰·검색 원문이 새로 노출되지 않는지 확인한다.

BE 선배포 후 FE를 연결한다. 롤백은 FE 조건 UI를 이전 통합 검색으로 복귀시킨 뒤 BE 이전 버전으로 되돌린다. DB 롤백은 없다. 릴리스 전 docs/api-spec.md §3.1, BACKEND-NOTES.md와 SEARCH-01의 승인된 변경 범위를 동기화하고 FE에 계약을 전달한다.

## Complexity Tracking

예외나 복잡성 추가 없음. 신규 프로덕션 타입은 조건 record 하나, 신규 SQL 진입점은 하나다. 성능·인증 검증이 끝나기 전 전체 기능 완료로 표시하지 않는다.
