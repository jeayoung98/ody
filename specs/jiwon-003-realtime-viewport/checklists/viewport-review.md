# Review Checklist: 실시간 뷰포트 사용자

**Purpose**: 사용자·프론트·백엔드가 구현 전에 요구사항의 의미를 같은 방식으로 이해하는지 확인  
**Created**: 2026-09-16  
**Documents**: [spec](../spec.md) · [contract](../contracts/realtime-viewport-websocket.md) · [tasks](../tasks.md)

## Product Scope

- [ ] CHK001 작은 화면은 개별 사용자, 넓은 화면은 셀 인원수라는 전환 기준이 명확한가?
- [ ] CHK002 사용자 20명 초과 시 일부를 자르지 않고 CLUSTERED로 전환하는 것이 화면 요구에 맞는가?
- [ ] CHK003 viewport가 재생·레이어 이동을 직접 수행하지 않는 경계가 명확한가?
- [ ] CHK004 따라가기·동승·비공개 정책이 이번 구현에서 제외됨이 명확한가?

## Request and Response

- [ ] CHK005 현재 raw PC 사각형과 이전 레이어 ancestorBounds의 차이가 프론트가 만들 수 있을 만큼 명확한가?
- [ ] CHK006 프론트 layer 0~7과 서버 1~8 변환 책임이 명확한가?
- [ ] CHK007 requestSeq 증가·응답 폐기 규칙이 빠른 팬·줌 경쟁을 모두 다루는가?
- [ ] CHK008 email이 프로필 이동·마커 갱신에 사용할 공개 식별자로 허용되는가?
- [ ] CHK009 INDIVIDUAL과 CLUSTERED 응답에서 nullable/빈 배열 규칙이 모호하지 않은가?
- [ ] CHK010 ENTER·MOVE·LEAVE를 email 기준 멱등 처리하는 규칙이 충분한가?
- [ ] CHK010-0 이전 화면용 ENTER·MOVE·LEAVE를 requestSeq로 버리는 규칙이 충분한가?
- [ ] CHK010-1 기존 `MapEngine.boxes`가 major와 viewport 누적 범위의 공통 원본인가?
- [ ] CHK010-2 prefetch만으로 join·viewport를 보내지 않는가?
- [ ] CHK010-3 늦은 major 응답으로 화면이 바뀌면 더 큰 requestSeq로 viewport를 갱신하는가?

## Accuracy and Performance

- [ ] CHK011 셀 후보 뒤 실제 사각형·bounds 필터가 필요한 이유가 명확한가?
- [ ] CHK012 layer 2 이상 count에서 다른 누적 branch를 제외해야 한다는 요구가 명확한가?
- [ ] CHK013 36셀 전환, 64마커 상한, 5초 갱신의 서로 다른 목적이 구분되는가?
- [ ] CHK014 좌표 batch와 Redis pipeline 요구가 N+1 방지를 검증할 만큼 구체적인가?
- [ ] CHK015 인기 곡·같은 셀 대량 사용자 상황의 상한과 fallback이 정의되어 있는가?

## Lifecycle and Recovery

- [ ] CHK016 화면 close와 전체 presence leave의 차이가 명확한가?
- [ ] CHK017 disconnect·TTL 만료·명시 leave가 모두 viewport 상태를 지운다고 명시되어 있는가?
- [ ] CHK018 이전 epoch가 새 연결을 지우지 못한다는 조건이 모든 종료 경로에 적용되는가?
- [ ] CHK019 재연결의 queue 구독→join→viewport→nearby 순서를 프론트가 구현할 수 있는가?
- [ ] CHK019-1 내려갔다 올라갈 때 기존 stack·query cache로 songs·camera·boxes를 복원하는 규칙이 명확한가?
- [ ] CHK020 CLUSTERED 주기 응답이 close 뒤 늦게 도착할 때 폐기 기준이 명확한가?

## Delivery Boundaries

- [ ] CHK021 76의 완료물만으로 최초 개별 스냅샷을 독립 검증할 수 있는가?
- [ ] CHK022 141이 기존 cell count를 재사용하면서 깊은 레이어 정확성을 보완하는가?
- [ ] CHK023 77의 PositionChanged 변경이 nearby 기존 동작을 깨뜨리지 않도록 회귀 검증이 포함되어 있는가?
- [ ] CHK024 각 Jira 완료 뒤 사용자 확인 전 다음 단계로 넘어가지 않는다고 명시되어 있는가?
- [ ] CHK025 realtime profile이 없는 데모 동작 무영향 검증이 포함되어 있는가?
