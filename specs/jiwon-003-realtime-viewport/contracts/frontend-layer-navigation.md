# Contract: 기존 프론트 레이어 탐색과 뷰포트 연결

## 0. 목적

프론트의 레이어별 곡 조회는 S15P21A405-219에서 이미 구현됐다. 이번 기능은 이를 다시 만들지 않고 `MapEngine`의 실제 탐색 상태를 뷰포트 소켓 요청에 연결한다.

- `useMapSongsQuery(boxes)`: 현재까지 선택한 범위를 캐시 키와 REST 파라미터로 사용
- `map-engine.ts`: 내려갈 범위를 `boxes`에 누적하고 다음 레이어를 미리 조회
- 올라가기: 이전 `boxes` 키의 React Query 캐시 재사용
- 실서비스 BFF: 받은 쿼리를 `GET /api/music/major`로 전달

## 1. 레이어 번호

| 의미 | 프론트 내부 | REST/소켓 |
| --- | --- | --- |
| 최상위 PC1·PC2 | 0 | 1 |
| PC3·PC4 | 1 | 2 |
| ... | ... | ... |
| PC15·PC16 | 7 | 8 |

소켓 경계에서 `serverLayer = frontendLayer + 1`로 변환한다. 기존 `LayerBox.layer`도 0부터 시작하므로 뷰포트의 `ancestorBounds`로 만들 때 각 layer에 1을 더한다.

## 2. 기존 곡 조회 계약

사이트 진입은 빈 `boxes`로 level 1을 조회한다.

```http
GET /bff/map/songs?level=1
```

다음 레이어는 이전 레이어에서 선택한 범위를 모두 보낸다.

```http
GET /bff/map/songs?level=3
  &pc1min=...&pc1max=...
  &pc2min=...&pc2max=...
  &pc3min=...&pc3max=...
  &pc4min=...&pc4max=...
```

실서비스 BFF는 이 쿼리를 `/api/music/major`로 그대로 전달한다. 목 모드는 작은 곡 풀을 보완하려고 범위 밖 가까운 곡을 채울 수 있으므로, 목 결과의 ID 중복을 서버 필터 정확성의 근거로 사용하지 않는다.

## 3. prefetch·캐시 규칙

- `prefetchBoxes`는 다음 레이어 후보일 뿐이다. prefetch 시작만으로 presence join이나 viewport를 보내지 않는다.
- 실제 `layer`와 `boxes`가 바뀌었을 때만 새 레이어의 실시간 상태로 본다.
- 곡 응답을 기다리는 제한 시간이 지나면 엔진은 현재 곡의 부분 집합으로 전환을 시작할 수 있다.
- 서버 곡 응답이 늦게 오면 엔진이 곡 집합을 다시 맞춘다. 이때 카메라 범위가 바뀌면 debounce 후 새 viewport를 보낸다.
- 올라갈 때 네트워크 요청이 없어도 오류가 아니다. `staleTime: Infinity`인 이전 `boxes` 캐시를 재사용할 수 있다.
- 각 레이어의 곡 수가 비슷해도 같은 집합이라는 뜻이 아니다. ID와 누적 범위를 기준으로 검증한다.

## 4. viewport 요청값 만들기

```ts
interface LayerBox {
  layer: number; // frontend 0-based
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

interface LayerBound {
  layer: number; // server 1-based
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}
```

- `ancestorBounds`: 현재 `boxes`를 값 그대로 복사하되 layer만 `+1`해 만든다.
- `currentRectangle`: 현재 레이어의 카메라가 실제로 보여주는 raw PC 사각형이다.
- 같은 레이어의 팬·줌은 `boxes`와 `ancestorBounds`를 바꾸지 않는다.
- 서버 layer N에는 ancestorBounds가 정확히 N-1개 있어야 한다.
- 곡 REST 요청과 viewport 요청은 같은 `boxes` 값에서 만들어야 한다.

## 5. 전송 시점

```text
다음 레이어 prefetch
  → 실제 descend로 layer·boxes 변경
  → 전환 화면 안정화
  → /app/presence/join(newLayer, currentMusicId)
  → /app/presence/viewport(newLayer, current rectangle, ancestorBounds)
```

- 전환 애니메이션 중간 카메라 값은 보내지 않는다.
- 전환 후 늦은 곡 응답으로 화면 범위가 다시 바뀌면 더 큰 `requestSeq`로 viewport를 갱신한다.
- 올라가기도 실제 layer·boxes 복원과 화면 안정화 뒤 join → viewport 순서로 보낸다.
- 곡 조회 실패 시 이전 레이어로 되돌린다는 새 정책은 이번 백엔드 범위에서 만들지 않는다. 기존 엔진의 대기·임시 집합·오류 처리를 유지한다.

## 6. 검증 항목

- [ ] 빈 boxes는 level 1, boxes N-1개는 level N 요청을 만든다.
- [ ] prefetch만으로 join·viewport가 전송되지 않는다.
- [ ] 실제 layer 변경 후 join → viewport 순서로 전송된다.
- [ ] major와 viewport의 누적 범위 값이 같다.
- [ ] 팬만 했을 때 ancestorBounds가 바뀌지 않는다.
- [ ] 줌아웃 때 캐시 적중으로 네트워크 요청이 없어도 이전 상태가 복원된다.
- [ ] 늦은 곡 응답으로 화면이 바뀌면 더 큰 requestSeq의 viewport가 전송된다.
