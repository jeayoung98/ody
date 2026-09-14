# 010. 로컬에서만 별자리가 안 그려짐 (배포는 멀쩡)

- 이슈: S15P21A405-303
- 커밋 / MR: (이 브랜치) · MR 미생성
- 날짜: 2026-09-14

## 증상

로컬에서 여정을 만들면 좌상단 `별자리 뷰` 택은 뜨는데 **지도에 별자리가 아예 안 그려진다.**
배포된 frontend/jenkins 에서는 정상이다.

1. `npm run dev` 로 로컬 실행
2. 여정 만들기 → 출발·도착 지정 → `경로 만들기`
3. 여정 패널에 경로 4곡이 뜨고 좌상단에 `별자리 뷰 4곡` 택도 뜬다
4. → 그런데 지도에는 아무 변화가 없다. 별이 모이지도, 선이 그어지지도 않는다

## 처음 의심한 것 (틀렸다)

**활동 전환 시 별자리가 지워지는 문제**로 봤다 (S15P21A405-302). 그건 실제로 있는 별개의
버그였지만 이 증상의 원인은 아니었다. 다른 활동이 없어도 재현되기 때문이다.

그 다음엔 `frontend/dev` 에 회귀가 들어갔다고 보고 `frontend/jenkins` 와 비교했다.
**두 브랜치의 앱 소스는 한 줄도 다르지 않았다** — 차이는 `Jenkinsfile` 과 `deploy.sh` 뿐이다.

```
$ git diff --stat origin/frontend/dev origin/frontend/jenkins
 frontend/Jenkinsfile | 164 +++++++++++---
 frontend/deploy.sh   | 453 ++++++++++++++++++++++++++++++++++++-----
```

소스가 같은데 한쪽만 된다 → 코드가 아니라 **실행 환경**이다. 여기서 방향을 바꿨다.

## 증거

브라우저 네트워크:

```
POST http://localhost:3000/api/constellations/layout → 403 Forbidden
```

엔진 상태 (`window.__odyEngine`):

```
{ constellation: null, indexSize: 1071, songsLoaded: 1071 }
```

`constellation === null` 이므로 `enterConstellation` 이 한 번도 불리지 않았다.
`index` 에는 1071곡이 다 있으니 좌표나 곡 목록 문제가 아니다.

배포 백엔드를 직접 호출해 `Origin` 헤더만 바꿔 봤다:

```
$ curl -X POST https://j15a405.p.ssafy.io/api/constellations/layout \
    -H 'Content-Type: application/json' -d '{"musicIds":[1,2,3]}'
200

$ curl ... -H 'Origin: https://j15a405.p.ssafy.io'
200

$ curl ... -H 'Origin: http://localhost:3000'
Invalid CORS request
403
```

## 원인

`src/constants/live-api-paths.ts` 의 `LIVE_API_PATHS` 에 `/api/constellations/layout` 이 있었다.
`next.config.ts` 의 rewrite 가 이 경로를 배포 백엔드로 그대로 흘려보낸다.

**rewrite 는 브라우저가 보낸 `Origin` 헤더를 그대로 백엔드에 전달한다.** 백엔드는 허용 목록에
없는 오리진을 `403 Invalid CORS request` 로 막는다. 로컬 페이지 오리진은 `http://localhost:3000`
이라 걸린다. 배포는 페이지 오리진이 백엔드와 같아서 통과한다 — 그래서 **로컬 개발자만 겪는다.**

배치가 영영 안 오므로 `layout` 이 `undefined` 로 남고,
[map-view.tsx](../../src/components/map/map-view.tsx) 의
`if (viewMode === "constellation" && layout)` 이 끝내 참이 되지 않아 `enterConstellation` 이
안 불린다. `별자리 뷰` 택은 `constellationMusicIds.length >= 2` 만 보므로 멀쩡히 떠 있다 —
**택은 뜨는데 그림이 없는** 이 증상이 그래서 나온다.

왜 이렇게 돼 있었나: S15P21A405-278 에서 좌표 원천을 서버 한 곳으로 고정하려고 프론트의 목
계산을 걷어냈다. 그 의도는 맞다. 다만 목을 걷어내면서 `/bff/` 라우트 핸들러까지 함께 지우고
rewrite 로 바꾼 것이 문제였다. 나머지 실데이터 호출은 전부 `src/app/bff/` 를 거치는데,
라우트 핸들러는 Next 서버가 새 요청을 띄우므로 `Origin` 이 안 붙어 이 함정을 피해 왔다.
별자리 배치만 예외였다.

`live-api-paths.ts` 주석은 A-17(인증 한시 해제) 원복으로 **401** 이 날 것을 경고하고 있었다.
실제로 먼저 온 것은 **403** 이었다. 대비한 실패와 실제 실패가 달랐다.

## 조치

계산은 그대로 백엔드에 두고, **부르는 경로만** `/bff/` 로 되돌렸다.

- `src/app/bff/constellations/layout/route.ts` 신설 — 백엔드를 대신 호출하고 `okLive`/`failLive` 로 실호출 표시
- `src/lib/backend.ts` 에 `backendPost` 추가. `backendGet` 과 40줄짜리 오류 처리를 공유하도록 `backendFetch` 로 한 번만 묶었다
- `API_ENDPOINTS.constellation.layout` → `/bff/constellations/layout`
- `LIVE_API_PATHS` 에서 해당 줄 제거 (이제 비어 있다)

지킨 것: 좌표 원천은 여전히 백엔드 하나다 (S15P21A405-278 의 의도). 목을 되살리지 않았고,
백엔드가 실패하면 조용히 목으로 떨어지지 않고 오류를 그대로 올린다.

## 확인

`npm run lint` · `npm test`(tsc --noEmit) · `npm run build` 통과. 빌드 산출물에
`ƒ /bff/constellations/layout` 이 들어갔다.

로컬 dev 서버에서 실제로 조작해 확인했다.

| 시나리오 | 결과 |
| --- | --- |
| 여정 만들기 → 경로 4곡 | 별자리가 그려진다. 곡 제목·경로선 표시 |
| 네트워크 | `POST /bff/constellations/layout → 200 OK` (고치기 전 403) |
| 엔진 상태 | `constellation.ids.length = 4`, `layout.length = 4`, `k = 1` |
| 개발 콘솔 | `[ODY ✅ 연결됨] /bff/constellations/layout 200 · 910ms` · 백엔드 경로 `/api/constellations/layout` |
| 순차 재생 | 별자리 유지, 택이 `1/4` 로 바뀌고 재생 곡에 내 위치 표시 |
| 택으로 뷰 끄기 | 별들이 제자리로 흩어짐 (`k = 0`), 목록은 남아 택은 `1/4` 유지 |
| 택으로 다시 켜기 | 다시 모임 (`k = 1`, `ids = 4`) |

플레이리스트 별자리는 확인하지 못했다 — 로그인이 목이라 플리를 만들 수 없었다. 경로가 같으므로
같이 고쳐졌을 것으로 보지만 **확인한 것은 아니다.**

## 배운 것

**"소스가 같은데 한쪽만 된다"가 나오면 즉시 코드 비교를 멈추고 환경을 본다.**
브랜치 diff 가 비어 있다는 사실 자체가 가장 강한 단서였다.

rewrite 프록시와 라우트 핸들러는 겉보기에 같은 일을 하지만 **헤더가 다르다.** rewrite 는
브라우저 헤더를 그대로 나르고, 라우트 핸들러는 서버가 새 요청을 만든다. 백엔드가 `Origin` 으로
차단하는 동안에는 이 차이가 곧 되고 안 되고를 가른다. `LIVE_API_PATHS` 에 경로를 추가할 때는
**로컬에서도 200 인지** 먼저 확인한다.

증상이 "일부만 안 보인다" 일 때 UI 게이트와 데이터 게이트가 서로 다른 조건을 보고 있는지 본다.
여기서는 택(`ids.length >= 2`)과 그림(`layout` 도착)이 다른 조건이라, 택이 떠 있는 것이
오히려 "데이터는 왔다" 는 착각을 줬다.
