# Implementation Plan: PC 레벨·중심좌표 기반 대표곡 조회

**Branch**: `docs/speckit-init` | **Date**: 2026-09-08 | **Spec**: [spec.md](spec.md)
**Input**: spec.md의 Q1~Q5 및 youtubeCnt/playCnt 후속 보충.
**Status**: 조건부 설계 초안. 구현 진입 게이트는 보류. tasks·운영 코드 생성 없음.

## Summary

현재 레벨 n을 PC(2n-1)·PC(2n)으로 해석하고, 서버의 레벨별 반경을 적용한 이동 원형 영역에서
기존 탐색 제약을 만족하는 곡을 youtubeCnt 내림차순 상위 k개로 반환한다.
playCnt는 동결 메타데이터이며 순위에 사용하지 않는다. 고정 그리드·모델 재학습·근사 후보 누락은 도입하지 않는다.

기존 MVC → MusicService → 데이터 조회 경계를 유지한다. 데이터 조회는 BE4가 제공·합의할 인터페이스로 분리한다.
현재 DB·스키마가 없으므로 SQL 제품·드라이버·DDL을 새 표준으로 결정하지 않는다.
미정 정책에 독립적인 구조는 설계하고, 의존 구간은 아래 B1~B6로 추적한다.

## Technical Context

**Language/Version**: Java 17 (`build.gradle`, Dockerfile).
**Primary Dependencies**: 저장소 선언 기준 Spring Boot 4.1.1, dependency-management 1.1.7,
webmvc, validation, actuator, Prometheus registry. 이번 작업에서 의존성 해석·빌드는 실행하지 않음.
**Build**: Gradle wrapper 9.7.1 선언. 실제 다운로드·실행 및 JDK 호환성 확인은 검증 전제다.
**Storage**: NEEDS CLARIFICATION — DB 제품·물리 스키마·접속/데이터 서비스 계약 미제공(B6).
JPA/JDBC/DB driver, 엔티티·리포지토리·마이그레이션·datasource 설정을 찾지 못했다.
**Testing**: 기존 JUnit Platform, MVC test, MockitoBean 활용. 실제 저장소 통합 검증은 B6 후 구성.
**Target Platform**: 현재 Dockerfile의 Java17 Linux 컨테이너, HTTP 8080. 로컬 PowerShell 실행 가능.
**Project Type**: 단일 Gradle Spring MVC backend. 별도 프론트·데이터 서비스 코드는 이 체크아웃에서 확인되지 않음.
**Performance Goals**: requirements §6 지도 조회·렌더링 전체 2초. API 단독 예산·부하·백분위 목표 미정.
**Constraints**: 원형·서버 반경·youtubeCnt 순위·고정 PCA16·누적 제약 보존. 미정 정책의 임의 기본값 금지.
**Scale/Scope**: team-roles §10 기준 v2.1-pca16, 6,624,399곡. 실제 적재 건수·분포·트래픽은 미검증.
k=1000은 잠정 후보이며 운영 기본값으로 설정하지 않는다.

## Constitution Check

| 원칙 | 설계 전 → 설계 후 | 판단 및 근거 |
| --- | --- | --- |
| I 명세 우선 | 보류 → 보류 | 기능 명세는 Draft, B1~B5 미해결. 문서 설계 요청만 승인된 상태 |
| II 계약 우선 | 보류 → 보류 | API 확인본·데이터 경계 제안 작성. 원본 동기화·FE/BE4/Core 합의 필요 |
| III 완료 전 검증 | 계획 필요 → 설계 충족/실행 미검증 | quickstart에 A1~A14와 검사 구분. 코드 검사 통과 주장 없음 |
| IV 데이터 재현성 | 증거 부족 → 보류 | 아티팩트 계보·실제 스키마가 없음(B6), data-model에 확인 항목 명시 |
| V 좌표 안정성 | 적용 → 설계 충족 | 한 요청에서 한 기준선·정책 버전 고정, 재학습 없음 |
| VI 탐색 일관성 | 연결 공백 → 보류 | 이전 제약 식별 계약 없음(B3). 전역 후보로 대체하지 않음 |
| VII 실험 격리 | 적용 → 설계 충족 | 실험 인덱스는 별도 평가, 운영 기준선 자동 교체 없음 |
| VIII 관측 | 방법 필요 → 설계 충족/미검증 | 기존 Actuator/Prometheus 활용, 지표·기밀 제외 정의 |
| IX 추정 금지 | 적용 → 설계 충족 | 미정 반경·k·동률·빈 결과·인증을 구현 관행으로 결정하지 않음 |
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

기존 루트는 `src/main/java/com/ssafy/backend/`이다. 신규 명칭은 아래 설계 제안이며 아직 파일이 없다.

| 위치 | 재사용·변경 설계 | 책임 |
| --- | --- | --- |
| music/controller/MusicController.java | 기존 GET·필드명 유지. 입력 DTO 바인딩으로 정리 가능 | HTTP 타입 해석·공통 응답, 업무 선정 로직 없음 |
| music/service/MusicService.java | getMajor의 미구현 예외를 orchestration으로 교체 | 정책 조회 → 조건 변환 → 조회 호출 → 응답 조립 |
| music/dto/MajorResponse.java, MusicDetail.java, Location.java | 우선 재사용, 타입·null 계약 검증 후 필요한 변경만 | wire 모델. 내부 조회 모델과 구분 |
| music/service/MajorQueryResolver.java (제안) | 레벨-축 추출, 정책과 중심을 묶는 순수 변환 | 검증된 조건 생성; DB·HTTP 비의존 |
| music/service/MajorSelectionPolicy.java (제안) | 서버 반경·k·경계 등 승인 정책 참조 | 값 자체는 B1~B4 후 제공. 숨은 기본값 없음 |
| music/retrieval/MajorTrackReader.java (제안) | BE4와 합의할 조회 port | 정확한 원형·누적 필터 및 top-k 계약 |
| music/retrieval/하위 어댑터 (위치 제안) | B6 확인 후 기존 BE4 접근 방식에 맞춤 | 데이터 접속·버전·물리 조회, 새 독립 검색엔진 생성 아님 |
| common/response, common/exception | ApiResponse·BusinessException·기존 handler 재사용 | BE1 공통 소유. 교체/확장 시 협의 |
| src/test/java/com/ssafy/backend/music/ | 기존 MVC 테스트 유지·확장, 순수 조건 및 실데이터 통합 검증 추가 예정 | 선정 의미와 외부 계약 검증 |
| build.gradle, application.yml | 기본 변경 없음. B6/인증 연동 결과에 필요한 의존성·설정만 검토 | 임의 ORM·캐시·보안 프레임워크 신규 채택 금지 |

**Structure Decision**: 기존 music/common 패키지를 유지하고, 서비스 내부 조건 변환과 BE4 I/O를 분리한다.
Core 인증·공통 체계가 들어오면 재사용한다. 현재 예외 처리 주석의 임시 공통 계층을 임의 삭제하지 않는다.

## 처리 흐름

1. Core 인증 경계에서 Bearer를 검증한다. 현재 인증 구현이 없어 통합 완료는 B5에 의존한다.
2. MVC가 level·pc1~pc16을 바인딩한다. 타입 오류는 기존 handler의 400 VALIDATION_ERROR를 재사용한다.
   생략·추가 축·비유한 수·level 범위 등의 정책은 B1 결정 후 검증기에 반영한다.
3. 한 요청의 기준선, 조회수 snapshot/revision, 승인 정책 식별자를 고정한다(B6).
4. 지원 확인 후 n→축 번호 2n-1, 2n을 계산하고 해당 필드만 현재 중심으로 해석한다.
   이 수식이 공개 8단계 승인이라는 뜻은 아니다. level=1 PC 생략은 별도 초기 조회 분기이며
   중심을 (0,0) 또는 전체 영역으로 대체하지 않는다(B2).
5. 서버 반경과 k를 읽고 기존 장르·이전 선택 제약을 결합한다. 제약을 확보하지 못하면
   전역 후보로 축소 구현하지 않는다(B3). 누락된 정책을 API 사용자 오류로 새로 정의하지 않는다.
6. 승인된 축 단위에서 중심 차이를 구하고 원 내부 조건을 평가한다.
   제곱 거리와 r² 비교로 sqrt를 생략하는 것은 동치 연산 선택이다.
   원주를 포함하는 <= 또는 제외하는 <, 원 PC/스케일 변환 여부는 B2 결정 후 적용한다.
   응답 PC 좌표는 저장된 고정값을 그대로 유지한다.
7. 데이터 조회는 '동일 버전 + 기존 제약 + 원 내부' 전체 후보에 youtubeCnt DESC를 적용한 뒤 top-k를 반환한다.
   동률·null·중복·부족분 처리와 k는 B4에 의존한다. playCnt·재생 링크 여부로 순위를 바꾸지 않는다.
8. ID·좌표·메타데이터를 같은 데이터 기준에서 읽고 순위를 보존해 MajorResponse.content를 조립한다.
   메타데이터 후조회 시 IN 결과 순서에 의존하지 않고 선정 ID 순서로 복원한다.
9. ApiResponse.ok로 반환한다. 예외는 기존 공통 오류로 매핑하고 데이터 장애를 빈 성공으로 바꾸지 않는다.
   후보 0곡의 정상 상태·본문은 B4 확정 전 구현하지 않는다. 지연·오류·반환 수 지표를 기록한다.

## 조회·인덱스 및 성능 설계

기준 의미는 완전한 원형/기존 조건 필터 후 조회수 순 top-k다. 관계형 저장소가 확인되면
필터·정렬·limit을 같은 쿼리 의미 안에 둔다. 제한된 전역 인기 목록을 먼저 materialize한 뒤 필터하지 않는다.

- 후보 1: 버전으로 제한된 youtubeCnt 순 인덱스 스캔에서 원/기존 조건을 적용하며 적격 k곡이 모일 때까지 탐색.
  좁거나 비인기 영역·0곡이면 많은 행을 읽으므로 '인덱스 있음=빠름'으로 가정하지 않는다.
- 후보 2: 현재 축의 원을 둘러싼 사각 범위로 후보를 줄이고, 정확한 원 판정 후 top-k 정렬.
  사각형은 검색 가속용 상위집합이며 제품의 영역이나 고정 그리드가 아니다. 두 축 range에 대한
  복합 B-tree의 효과는 DB별 실행계획으로 확인한다. 모든 8축 쌍 인덱스를 즉시 생성하지 않는다.
- 후보 3: 기존 BE4 조회 서비스가 같은 정확성 계약을 제공하면 재사용한다.
  유사도 ANN top-k는 인기 top-k를 보장하지 않으므로 대체하지 않는다.

대상 DB·물리 스키마가 없으므로 최종 인덱스와 DDL은 B6 이후 결정한다. 상세 근거는 research.md.
확인할 위험은 원형 조건의 낮은 선택도, 조회수와 좌표의 상관, 정렬 spill, 조인 중복, 업데이트 비용,
잠정 k=1000의 메타데이터·PC16 전송량·직렬화·렌더링 비용이다. 약 662만 곡의 전부를 JVM에 적재하지 않는다.
공유 캐시는 초기 필수 설계에서 제외한다. 이후 도입 시 버전·정책·조회수 revision·모든 선택 조건을 키에 포함해야 한다.

## 보류 항목과 진행 조건

| ID | 미결정 / 필요한 확인 | 의존 구간 |
| --- | --- | --- |
| B1 | spec P1: 지원 레벨, level 생략, 추가/누락 PC, 수치 유효성 | 요청 검증·오류 인수 기준 |
| B2 | 반경 값·단위·축 스케일·원주 포함, level1 PC 생략의 조회 대상 | 원형 판정·초기 조회·정확성 fixture |
| B3 | 기존 장르·이전 PC 선택 후보를 현재 한 쌍 요청과 연결하는 계약 | 후보 제약·인증된 상태 접근. 세션/새 파라미터 임의 추가 금지 |
| B4 | k 확정, 동률·null·중복·부족/빈 결과·페이지 계약·조회수 갱신 일관성 | 정렬·응답 및 정확한 기대값 |
| B5 | Core 인증 연동 및 토큰 없음 코드, DTO의 genres/null/정수 표현 범위 | 인증 통합·역직렬화·데이터 표현 |
| B6 | BE4 실제 저장소·조회 인터페이스·스키마·ID 매핑·manifest·접근 권한·데이터 분포 | 어댑터·인덱스·계보·성능 측정 |

C1/C4 레벨 표현은 clarification으로 해소됐으나 원본 동기화가 필요하고,
C2 페이지·C3 생략 규칙은 미해결이다. docs/api-spec.md §0.6·§3.4 및 requirements §1.3·MAP-04의
필요 변경은 spec의 원본 동기화 절을 따른다. 이 계획은 원본을 수정하지 않는다.
B1~B5는 제품/공개 계약 합의, B6는 기존 구조·데이터 증거 확인이다.
새 아키텍처나 경계 변경이 필요하면 관련 팀 합의 후 ADR을 기록한다. research의 제안 자체는 승인 ADR이 아니다.

## Complexity Tracking

추가 서비스·DB·ORM·캐시를 확정하지 않는다. 미해결 게이트를 예외로 면제하지 않는다.
본 조건부 설계는 요청된 산출물이며, 구현 착수 전에 위 보류 항목과 계약 검토를 완료해야 한다.
