# Specification Quality Checklist: 실시간 뷰포트 사용자

**Purpose**: 구현 계획에 들어가기 전 명세의 완전성과 품질 확인  
**Created**: 2026-09-16  
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] 사용자 가치와 기능 경계가 정의되어 있다.
- [x] 76·141·77의 역할과 구현 순서가 구분되어 있다.
- [x] 현재 구현을 재사용하는 지점과 새로 만드는 지점이 구분되어 있다.
- [x] 코드 구현 전에 검토해야 할 결정을 별도 표로 공개했다.
- [x] 구현 상세가 필요한 Redis·WebSocket 계약은 spec이 아니라 plan/data-model/contracts에 분리했다.

## Requirement Completeness

- [x] User Story 3개가 독립 검증 가능하다.
- [x] Acceptance Scenario V1~V49가 Given/When/Then으로 작성되어 있다.
- [x] Functional Requirement에 검증 가능한 MUST 조건이 있다.
- [x] 성공 기준에 시간·개수·잔여 상태가 포함되어 있다.
- [x] edge case와 out-of-scope가 정의되어 있다.
- [x] demo profile 무영향 조건이 포함되어 있다.
- [x] frontend·music·auth·infra 경계가 표시되어 있다.
- [x] D1 requestSeq를 사용자가 확정했다.
- [x] D2 기본 셀 36개 또는 사용자 20명 초과 시 CLUSTERED 전환을 사용자가 확정했다.
- [x] D3 layer 2+ 정확 집계를 사용자가 확정했다.
- [x] D4 사용자 식별자 email을 사용자가 확정했다.

## Contract Readiness

- [x] C→S viewport·close 요청이 예시 JSON으로 정의되어 있다.
- [x] S→C individual·clustered·cell counts·delta가 정의되어 있다.
- [x] server seq와 client requestSeq의 차이가 정의되어 있다.
- [x] 스냅샷·인원수·델타의 오래된 requestSeq 폐기 규칙이 정의되어 있다.
- [x] 최초 연결·레이어 이동·재연결 순서가 정의되어 있다.
- [x] 이미 구현된 boxes·prefetch·query cache를 재사용하는 계약이 정의되어 있다.
- [x] major와 viewport가 같은 ancestorBounds를 사용하는 규칙이 정의되어 있다.
- [x] prefetch·늦은 응답·올라가기 캐시의 연동 규칙이 정의되어 있다.
- [x] 프론트 멱등 처리 규칙이 정의되어 있다.
- [ ] 프론트 담당자가 계약을 검토했다.

## Implementation Readiness

- [x] tasks가 정확한 파일 경로와 Jira 번호를 포함한다.
- [x] 각 Jira 뒤에 강제 STOP checkpoint가 있다.
- [x] 단위·실제 Redis·컨텍스트·2세션·full build 검증이 계획되어 있다.
- [x] N+1 방지와 fanout 상한이 계획되어 있다.
- [x] old epoch와 stale request 방어가 계획되어 있다.
- [x] 확정된 36셀·20명·64마커·250ms·5초 값을 설정으로 관리하는 작업이 계획되어 있다.
- [ ] 사용자 명세 검토가 완료되었다.

## Notes

- D1~D4는 2026-09-16 사용자 확인으로 확정했다.
- 남은 미완료 항목은 전체 명세와 프론트 계약 검토다.
