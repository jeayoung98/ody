# Data Model: 실시간 뷰포트 사용자

## 1. 좌표와 레이어

- 곡 원본 좌표: `double[16]`
- 서버 레이어: `1..8`
- layer N은 PC(2N-1)·PC(2N)를 현재 화면 x/y로 사용한다.
- `minX/maxX/minY/maxY`는 프론트 카메라에서 계산한 현재 표시 축의 raw PC 범위다.
- `ancestorBounds`는 이전 layer 1..N-1에서 다음 레이어로 들어갈 때 선택한 raw PC 사각형 목록이다.
- 서버는 현재 raw PC 범위를 축별 p01/p99 설정으로 정규화한 뒤 셀 범위를 계산한다.
- 기본 격자: 레이어별 `16 × 16`

### Front LayerBox — 기존 구현

```text
layer: int (0..7)
xMin, xMax, yMin, yMax: raw PC values
```

`MapEngine.boxes`가 현재 탐색 경로의 원본이다. REST는 이 값을 PC 쿼리로 직렬화하고, viewport는 같은 값을 `LayerBound`로 바꾸되 layer에 1을 더한다.

### LayerBound

```text
layer: int
minX, maxX: raw PC values for PC(2*layer-1)
minY, maxY: raw PC values for PC(2*layer)
```

- layer 1 viewport: `ancestorBounds=[]`
- layer N viewport: `ancestorBounds.size == N-1`
- 목록 순서와 `LayerBound.layer`는 1부터 N-1까지 연속이어야 한다.

## 2. Redis Keys

### 기존 키 — 읽기·재사용

| Key | Type | 목적 |
| --- | --- | --- |
| `presence:user:{email}` | Hash | 현재 epoch, 곡, 레이어, 좌표, 셀 |
| `layer-listeners:{layer}:{musicId}` | Set | 해당 레이어·곡 청취자 |
| `active-song:cell:{layer}:{cellX}:{cellY}` | Set | 셀에 활성화된 곡 ID |
| `active-song:cells:{layer}` | Set | 활성 셀 목록 |
| `cell:usercount:{layer}` | Hash | 기본 셀별 전체 인원수 |

### 신규 키 — viewport 소유

| Key | Type | 값 | 목적 |
| --- | --- | --- | --- |
| `viewport:cell:{layer}:{cellX}:{cellY}` | Set | 수신자 email | 개별 모드 셀 변화 수신자 |
| `viewport:meta:{email}` | Hash | 아래 Meta 필드 | 현재 연결의 화면·구독 원본 |
| `viewport:clustered:{layer}` | Set | 수신자 email | 5초 인원수 갱신 대상 |

### Viewport Meta

| Field | Type | 설명 |
| --- | --- | --- |
| `epoch` | long | 현재 소켓 연결 버전 |
| `requestSeq` | long | 마지막으로 적용한 화면 요청 순번 |
| `mode` | enum | `INDIVIDUAL` 또는 `CLUSTERED` |
| `layer` | int | 서버 레이어 1~8 |
| `minX/maxX/minY/maxY` | double | 현재 표시 축의 raw PC 사각형 |
| `ancestorBounds` | string | 이전 레이어별 raw PC 사각형의 직렬화 값 |
| `cellKeys` | string | 구독한 기본 셀 key 목록. CLUSTERED는 빈 값 |

`ancestorBounds`와 `cellKeys`는 Lua가 그대로 저장·읽을 수 있는 결정적 형식을 사용한다. bounds는 layer 오름차순, 셀은 `cellX:cellY` 오름차순으로 정렬해 같은 요청이 같은 문자열을 만든다.

## 3. Messages

### ViewportRequest

```text
requestSeq: long (> 0)
layer: int (1..8)
minX, maxX, minY, maxY: double
ancestorBounds: List<LayerBound>
  LayerBound.layer: int
  LayerBound.minX, maxX, minY, maxY: double
```

### ViewportSnapshot

```text
requestSeq: long
mode: INDIVIDUAL | CLUSTERED
layer: int
groups: List<ViewportGroup>          # INDIVIDUAL only, total users <= 20
resolution: int                     # CLUSTERED only: 16, 8, 4, ...
cells: List<ViewportCellCount>       # CLUSTERED only
```

### ViewportGroup

```text
musicId: long
x, y: double
users: List<ViewportUser>
```

### ViewportUser

```text
email: string
nickname: string
imageUrl: string | null
riderCount: int
```

### ViewportCellCount

```text
cellX, cellY: int
count: int (> 0)
```

### ViewportDelta

```text
requestSeq: long                       # 이 델타를 판정한 수신자 화면
email: string
nickname: string | null              # LEAVE는 생략 가능
imageUrl: string | null
musicId: long | null
x, y: double | null
riderCount: int | null
```

이벤트 종류는 봉투의 `type`으로 구분한다: `VIEWPORT_ENTER`, `VIEWPORT_MOVE`, `VIEWPORT_LEAVE`.
프론트는 delta.requestSeq가 현재 viewport requestSeq와 다르면 적용하지 않는다.

### PositionChanged — 내부 이벤트 목표형

```text
email: string
epoch: long
oldLayer: int | null
newLayer: int | null
oldMusicId: long | null
newMusicId: long | null
oldCell: string | null
newCell: string | null
newPc: double[16] | null
newX, newY: double | null
```

- 진입: old 상태 null
- 곡/셀 이동: old와 new 모두 존재
- 레이어 이동: oldLayer != newLayer
- 이탈: new 상태 null

`newPc`를 이벤트에 싣지 않기로 결정하면 `newMusicId`를 배치 조회하는 동등한 경로가 반드시 있어야 한다. 수신자마다 좌표를 다시 조회하면 안 된다.

## 4. State Transitions

```text
NONE --viewport(small)--> INDIVIDUAL
NONE --viewport(large)--> CLUSTERED
INDIVIDUAL --viewport(small)--> INDIVIDUAL  # cell 구독 교체
INDIVIDUAL --viewport(large)--> CLUSTERED   # cell 구독 제거
CLUSTERED --viewport(large)--> CLUSTERED    # meta 교체
CLUSTERED --viewport(small)--> INDIVIDUAL   # clustered 제거, cell 구독 추가
INDIVIDUAL|CLUSTERED --close/leave--> NONE
```

## 5. Invariants

1. email당 `viewport:meta`는 최대 1개다.
2. meta의 mode가 INDIVIDUAL이면 cellKeys의 모든 Set에 email이 있어야 한다.
3. meta의 mode가 CLUSTERED이면 `viewport:clustered:{layer}`에 email이 있고 cellKeys는 비어야 한다.
4. epoch가 현재 presence와 다르면 viewport 상태를 생성·변경·삭제하지 않는다.
5. 저장 requestSeq보다 작거나 같은 요청은 상태를 변경하지 않는다.
6. close·leave 이후 meta와 모든 역방향 인덱스에서 email이 사라져야 한다.
7. INDIVIDUAL snapshot과 delta는 현재 raw PC 사각형과 ancestorBounds를 모두 만족해야 한다.
8. CLUSTERED count는 0인 셀을 포함하지 않는다.

## 6. Atomic Operations

### subscriptionReplace

입력: email, epoch, requestSeq, mode, layer, currentRectangle, ancestorBounds, newCellKeys.

1. presence의 epoch 일치 확인
2. 기존 meta requestSeq보다 큰지 확인
3. 기존 INDIVIDUAL cellKeys에서 SREM
4. 기존 CLUSTERED layer에서 SREM
5. 새 모드에 맞게 cell SADD 또는 clustered SADD
6. meta 전체 교체
7. 적용 여부 반환

### subscriptionClose

입력: email, epoch, requestSeq.

1. meta 존재 확인
2. epoch 일치 확인
3. close requestSeq와 저장된 최신 requestSeq가 같은지 확인
4. 저장 cellKeys/clustered layer에서 SREM
5. meta DEL

### presenceLeave extension

기존 presence leave 원자 작업 안에서 viewport meta를 읽고 역방향 인덱스를 제거한다. 이전 epoch의 leave는 아무 것도 지우지 않는다.

## 7. Data Access Rules

- music Mapper 직접 의존 금지. realtime Port → 기존 MusicDetailReader 어댑터 사용.
- 사용자 표시 정보는 기존 5분 캐시를 사용하고 batch API가 없으면 중복 email을 먼저 제거한다.
- Redis 후보 조회는 pipeline을 사용한다.
- 화면 범위별 DB 결과 전체를 장기 캐시하지 않는다. 곡 좌표 자체만 기존 불변 데이터 특성에 맞춰 캐시할 수 있다.
