# Research: 실시간 뷰포트 사용자

## R0. 기존 레이어별 곡 조회를 재사용한다

**Decision**: S15P21A405-219에 구현된 `useMapSongsQuery(boxes)`와 `MapEngine`의 누적 boxes·prefetch·query cache를 그대로 사용한다. viewport의 ancestorBounds는 현재 boxes에서 만든다.

**Reason**: 승인된 탐색 계약은 `candidate(N+1) ⊆ candidate(N)`이고, DB 조회도 level 2 이상에서 이전 LayerBox를 요구한다. 같은 곡 집합을 축만 바꿔 재투영하면 다른 탐색 분기의 곡과 사용자가 섞인다.

**Observed behavior**: 다음 레이어는 미리 조회되고, 응답이 늦으면 임시 곡 집합으로 전환한 뒤 서버 결과로 다시 맞춘다. 올라가기는 `staleTime: Infinity` 캐시를 재사용해 새 요청이 없을 수 있다. 목 BFF는 작은 데이터 풀 때문에 범위 밖 곡을 채울 수 있다.

**Integration rule**: prefetch만으로 실시간 상태를 바꾸지 않는다. 실제 layer·boxes 변경과 화면 안정화 뒤 join·viewport를 보내고, 늦은 곡 응답으로 화면이 다시 바뀌면 viewport를 갱신한다.

## R1. viewport는 play와 분리한다

**Decision**: viewport는 조회·구독만 한다. 음악 변경은 `/music/play`, 레이어 변경은 같은 곡의 `/app/presence/join` 재호출이 담당한다.

**Reason**: 현재 Presence의 상태 변경 원본을 유지하고 화면 팬·줌이 사용자 위치를 바꾸는 부작용을 막는다.

## R2. 요청 순번을 별도로 둔다

**Decision**: 기존 봉투 `seq`와 별개로 C→S `requestSeq`를 추가한다.

**Reason**: 봉투 seq는 서버가 보낸 메시지 순서이고, requestSeq는 빠른 팬·줌 요청의 최신 여부다. 한 값으로 두 문제를 해결할 수 없다.

**Alternative rejected**: 서버 도착 순서만 신뢰 — 네트워크·비동기 조회 완료 순서가 달라 최신 화면이 덮일 수 있다.

## R3. 구독을 먼저 바꾸고 스냅샷을 읽는다

**Decision**: `구독 교체 → 현재 상태 조회` 순서를 사용한다.

**Reason**: 조회 후 구독하면 그 사이에 발생한 이동을 놓친다. 먼저 구독하면 스냅샷과 중복된 델타는 생길 수 있지만 email 기반 upsert로 안전하게 처리할 수 있다.

## R4. 구독 교체는 Lua 한 번으로 처리한다

**Decision**: 이전 셀 제거, 새 셀 추가, clustered 인덱스 변경, meta 저장을 원자 처리한다.

**Reason**: 팬·줌과 disconnect가 겹쳐도 중간 상태의 구독이 남지 않는다. epoch와 requestSeq 비교도 같은 원자 경계 안에 둔다.

## R5. 후보 셀 뒤에 정확 필터를 둔다

**Decision**: Redis 셀은 후보 축소에만 쓰고, 현재 레이어의 raw PC 사각형과 이전 레이어의 ancestorBounds를 다시 검사한다. layer 1의 ancestorBounds는 빈 목록이다.

**Reason**: 셀은 화면보다 크고, layer 2 이상에서는 현재 표시 축만으로 이전 분기를 구분할 수 없다.

## R6. 곡 좌표는 배치 조회한다

**Decision**: `MusicLocationPort.findLocations(ids)`를 추가하고 기존 `MusicDetailReader.findLocationsByIds`에 위임한다.

**Reason**: 후보 곡마다 SQL을 실행하는 N+1을 피하면서 music 영역의 Mapper를 realtime이 직접 참조하지 않는다.

## R7. 20명 초과는 CLUSTERED로 전환한다

**Decision**: 정확 필터 결과가 20명을 넘으면 일부를 잘라내지 않고 CLUSTERED로 전환한다.

**Reason**: 20명만 선택하면 한 명이 나갔을 때 숨겨진 사용자 중 누구를 채울지 추가 상태가 필요하고 델타와 스냅샷이 어긋난다. CLUSTERED는 응답과 fanout을 제한하면서 전체 인원수를 보존한다.

**Review**: 20은 현재 프론트 `MAP_FRIENDS_MAX`와 맞춘 값이며 설정으로 관리한다.

## R8. 뭉침 기준은 셀 수, 출력 기준은 마커 수다

**Decision**: 기본 셀 36개 초과 또는 사용자 20명 초과 시 CLUSTERED로 전환하고, 출력 셀은 최대 64개가 될 때까지 16→8→4로 접는다. 레이어 번호는 모드 기준이 아니다.

**Reason**: 조회 부하를 미리 제한하는 기준과 화면 마커 수를 제한하는 기준의 목적이 다르다.

## R9. 깊은 레이어의 인원수는 정확 집계한다

**Decision**: layer 1은 `cell:usercount`를 바로 쓰고 layer 2 이상은 ancestorBounds로 곡을 거른 뒤 listener 수를 합산한다.

**Reason**: 현재 인원수 Hash 키는 layer+cell뿐이어서 같은 현재 셀에 속한 다른 이전 분기까지 합쳐진다.

**Alternative rejected**: 모든 레이어에서 Hash 직접 사용 — 빠르지만 잘못된 분기의 사람을 표시한다.

## R10. CLUSTERED는 개별 델타를 받지 않는다

**Decision**: 5초마다 셀 인원수 전체를 갱신한다.

**Reason**: 넓은 화면에서 개별 이동 fanout을 막는 것이 뭉침 모드의 목적이다. 셀 수 데이터는 idempotent하여 유실 복구도 쉽다.

## R11. 델타 이벤트는 old/new 레이어를 구분한다

**Decision**: `PositionChanged`에 oldLayer와 newLayer를 둔다. 진입은 old null, 이탈은 new null이다.

**Reason**: 기존 단일 layer로는 레이어 이동 때 옛 구독자와 새 구독자를 정확히 찾을 수 없다.

## R12. 재연결은 명시적 재전송으로 복구한다

**Decision**: 프론트가 queue 구독 후 join→viewport→nearby/open을 재전송한다.

**Reason**: 끊어진 연결의 화면 상태를 서버가 임의로 복원하면 사용자가 이미 닫은 패널이나 오래된 범위를 살릴 수 있다.

## R13. 사용자 식별자는 email을 쓴다

**Decision**: viewport 사용자와 델타에 email을 포함한다.

**Reason**: 프로필 버튼 연결, 동일 사용자 마커 upsert, LEAVE 제거를 위한 현재 시스템의 안정적인 키다.

**Privacy note**: 로그와 metric tag에는 email을 남기지 않는다. 별도 공개용 userId가 생기면 계약 버전 변경으로 교체한다.

## R14. 현재 전송 기반은 단일 인스턴스 범위다

**Decision**: `InProcessEventBus`와 Spring Simple Broker를 그대로 사용한다.

**Reason**: 현재 realtime 구현과 일관되고 이번 Jira 범위를 넘는 운영 인프라 변경을 피한다.

**Future**: 백엔드 다중 인스턴스 전환 전에 Redis Streams/Kafka와 외부 STOMP broker 중 운영 구조에 맞는 방식을 별도 결정한다.
