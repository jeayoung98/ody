# Quickstart: 실시간 뷰포트 검증

이 문서는 구현 후 검증 순서와 2026-09-17 로컬 실행 결과를 기록한다.

## 0. 전제

- backend 실행 프로파일: `test,realtime`
- Redis: 로컬 또는 Docker `127.0.0.1:6380`
- 로그인 사용자 2명 A, B의 STOMP 토큰
- A와 B가 재생할 위치가 있는 곡 ID 최소 3개
- 프론트가 없으면 STOMP 테스트 클라이언트로 동일 메시지를 전송

## 1. 정적 검증

```powershell
cd C:\Users\SSAFY\Desktop\특화프로젝트\S15P21A405\backend
.\gradlew.bat compileJava
.\gradlew.bat test
.\gradlew.bat build
```

## 2. Redis 통합 테스트

```powershell
docker run --rm -d --name ody-viewport-test-redis -p 127.0.0.1:6380:6379 redis:7.4.11-alpine
cd C:\Users\SSAFY\Desktop\특화프로젝트\S15P21A405\backend
$env:RUN_REDIS_INTEGRATION="true"
$env:REDIS_TEST_HOST="127.0.0.1"
$env:REDIS_TEST_PORT="6380"
.\gradlew.bat test --tests "com.ssafy.backend.realtime.repository.redis.integration.*RedisIntegrationTests"
docker stop ody-viewport-test-redis
```

확인 항목:

- INDIVIDUAL 교체 후 이전 `viewport:cell:*`에서 email 제거
- 새 cell Set과 `viewport:meta:{email}`에 같은 상태 저장
- 낮은 requestSeq 요청은 변화 없음
- CLUSTERED 전환 후 cell Set 잔여 없음, clustered Set에만 존재
- close·presence leave 후 meta와 역방향 인덱스 잔여 없음
- 이전 epoch close가 새 epoch 상태를 지우지 않음

## 3. S15P21A405-76 시나리오

1. 기존 `useMapSongsQuery([])`가 BFF를 통해 `/api/music/major?level=1` 곡 집합을 받는다.
2. layer 1 viewport는 `ancestorBounds=[]`로 보낸다.
3. A와 B를 CONNECT하고 같은 레이어에 join한다.
4. A가 B의 예정 화면 안 곡을 재생한다.
5. B가 작은 viewport(requestSeq=1)를 보낸다.
6. B가 `INDIVIDUAL` snapshot에서 A의 email·nickname·musicId·좌표를 받는지 확인한다.
7. B가 다른 작은 viewport(requestSeq=2)를 보낸다.
8. Redis에서 requestSeq=1의 셀 구독이 제거되고 requestSeq=2만 남는지 확인한다.
9. requestSeq=1을 다시 보내도 상태가 바뀌지 않는지 확인한다.

## 3.1 레이어별 곡 조회·viewport 정합 시나리오

1. layer 1에서 다음 레이어 `prefetchBoxes`가 생겨도 join·viewport가 전송되지 않는지 확인한다.
2. 실제 descend 후 기존 boxes의 PC1·PC2 범위가 major 요청과 `ancestorBounds[0]`에 같은 값으로 들어가는지 확인한다.
3. 전환 화면이 안정된 뒤 layer 2 join → viewport 순서인지 확인한다.
4. layer 3 진입 때 PC1·PC2와 PC3·PC4 두 범위가 모두 major와 viewport에 전달되는지 확인한다.
5. 늦은 major 응답으로 화면 범위가 바뀌면 더 큰 requestSeq의 viewport가 나가는지 확인한다.
6. layer 2로 올라갈 때 새 네트워크 요청이 없어도 캐시로 이전 songs·camera·boxes가 복원되는지 확인한다.
7. 목 모드의 범위 밖 곡 채우기를 실서비스 범위 필터 실패로 판정하지 않는지 확인한다.

## 4. S15P21A405-141 시나리오

1. B가 기본 셀 36개를 넘는 viewport 또는 사용자 20명을 넘는 좁은 viewport를 보낸다.
2. `CLUSTERED` snapshot과 resolution·cells를 확인한다.
3. 셀 마커가 64개 이하인지 확인한다.
4. A가 곡을 이동한다.
5. B가 개별 델타를 받지 않고 5초 이내 새 `VIEWPORT_CELL_COUNTS`를 받는지 확인한다.
6. layer 2 이상에서 다른 누적 branch의 사용자가 count에 섞이지 않는지 fixture로 확인한다.

## 5. S15P21A405-77 두 세션 시나리오

1. B가 작은 viewport를 열고 초기 snapshot을 받는다.
2. A가 화면 밖 곡에서 화면 안 곡으로 이동한다 → B `VIEWPORT_ENTER`.
3. A가 화면 안의 다른 곡으로 이동한다 → B `VIEWPORT_MOVE`.
4. A가 화면 밖 곡으로 이동한다 → B `VIEWPORT_LEAVE`.
5. A가 새 레이어로 join한다 → 옛 레이어 B는 LEAVE, 새 레이어 구독자는 ENTER.
6. B가 viewport close를 보내고 A가 다시 들어온다 → B에게 델타 없음.
7. B가 재연결하여 queue 구독→join→viewport를 보낸다 → 최신 snapshot 수신.
8. 이전 B 연결의 늦은 close를 실행한다 → 새 구독 유지.
9. B가 requestSeq=2 화면으로 바꾼 뒤 requestSeq=1 델타를 전달한다 → 프론트 상태 변화 없음.

## 6. 데모 영향 확인

realtime 프로파일 없이 기존 데모 설정으로 서버를 부팅한다.

확인 항목:

- viewport 서비스·scheduler·controller 추가 빈이 활성화되지 않음
- 로그인 없는 기존 데모 endpoint 동작이 그대로임
- realtime 설정 누락 때문에 기본 서버가 실패하지 않음

## 6.1 관측성 확인

- viewport 요청 로그/metric에 처리 시간, 모드, 후보 셀·곡·사용자 수가 있는지 확인한다.
- delta 로그/metric에 수신 후보 수와 실제 발송 수가 있는지 확인한다.
- stale epoch/requestSeq 요청에서 거부 수가 증가하는지 확인한다.
- 5초 셀별 인원수 갱신에서 대상 수·성공 발송 수·처리 시간이 기록되는지 확인한다.
- viewport close의 `CLOSED`·`OLD_REQUEST`·`STALE_CONNECTION` 결과가 기록되는지 확인한다.
- email·토큰·원시 16차원 좌표가 로그 본문과 metric tag에 없는지 확인한다.

## 7. 결과 기록 표

| 검증 | 상태 | 증거/메모 |
| --- | --- | --- |
| compileJava | 성공 | 전체 test·build 과정에서 확인 |
| viewport unit tests | 성공 | snapshot·delta·scheduler·metrics 테스트 통과 |
| Redis integration | 성공 | 실제 Redis에서 구독 교체·닫기·이탈 정리 통과 |
| two-session event scenario | 성공 | ENTER→MOVE→LEAVE→close→reconnect 통과 |
| full test | 성공 | `BUILD SUCCESSFUL` (1m 29s) |
| full build | 성공 | `BUILD SUCCESSFUL` (3s) |
| realtime profile boot | 성공 | `ViewportContextTests` 통과 |
| demo profile boot | 성공 | realtime 프로파일 없는 전체 테스트 컨텍스트 통과 |
| metric privacy | 성공 | 허용 태그 키와 email·token·좌표 태그 제외 검증 통과 |
