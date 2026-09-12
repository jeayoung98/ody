# 성능 계측 (S15P21A405-215)

지도 렌더링 성능을 재는 도구다. **측정 결과는 [../PERF-LOG.md](../PERF-LOG.md) 에 쌓인다.**

| 파일 | 역할 |
| --- | --- |
| `perf-bench.js` | 콘솔에 붙여넣어 실행하는 계측 스크립트 |
| `../PERF-LOG.md` | 측정 기록 (표 + 상세 JSON). 스크립트가 자동으로 덧붙인다 |
| `../src/app/dev-perf-log/route.ts` | 자동 기록을 받는 **개발 전용** 라우트 |

앱 소스는 건드리지 않는다 — 캔버스 2D 컨텍스트와 `window.__odyEngine` 을 런타임에
가로채서 잰다. 그래서 `draw-map.ts` 나 `map-engine.ts` 가 바뀌어도 계측이 따라 깨지지 않는다.

---

## 언제 재나

매번 잴 필요는 없다. 비교가 필요한 시점에만 잰다.

- 지도 렌더링 코드를 건드렸을 때
- 실데이터가 붙었을 때
- 레이어당 곡 수(N) 상한이 바뀌었을 때

## 재는 법

1. `npm run dev` 후 지도 화면(`/`)을 연다. 로그인 게이트가 막으면 콘솔에서:
   ```js
   localStorage.setItem("ody:access-token", JSON.stringify("dev-token"));
   localStorage.setItem("ody:tutorial-done", JSON.stringify(true));
   localStorage.setItem("ody:my-music-id", JSON.stringify(1));
   location.reload();
   ```
2. **일반 브라우저 창을 앞에 두고 실제로 화면에 보이게 한다.** 가려져 있거나 화면에 합성되지 않으면
   `requestAnimationFrame` 이 멈춰 프레임 지표가 전부 0 이 된다. `document.visibilityState` 가
   `"visible"` 이어도 그럴 수 있다 — IDE 내장 미리보기 패널·백그라운드 창에서 실제로 그랬다.
   프레임이 0 이면 스크립트가 경고를 띄운다. 나머지 지표(엔진·로딩·메모리·상태)는 그 상태에서도 유효하다.
3. `perf-bench.js` 내용을 콘솔에 통째로 붙여넣는다. 5초간 잰다.
4. **`../PERF-LOG.md` 에 자동으로 기록된다.** 스크립트가 개발 전용 라우트(`/dev-perf-log`)로
   결과를 보내 요약 표에 행을, 그 밑에 상세 블록을 끼워 넣는다.
   상세 블록은 **사람이 읽는 마크다운 표**(프레임 / 그리기 종류별 / 상태 변경 / 엔진 / 상태 / 로딩 / 환경)이고,
   재분석용 원본 JSON 은 그 안에 한 겹 더 접혀 있다.
5. 표의 `???` 두 칸만 채운다. 브라우저가 알 수 없는 값이라 이것만 수동이다.
   - 커밋: `git rev-parse --short HEAD`
   - 번들: `npm run build` 후 `.next/static/chunks` 의 gzip 합계

자동 기록이 실패하면(라우트가 없거나 프로덕션 빌드면) 콘솔에 붙여넣을 한 줄과 JSON 을 그대로
출력하므로 손으로 넣으면 된다.

측정할 동작이 있으면 **스크립트를 붙여넣은 뒤 5초 동안 직접 조작한다.** 예를 들어 "줌 중
리렌더가 몇 번인가"는 그 5초 동안 휠을 굴려야 나온다. 가만히 두면 정지 상태의 숫자만 나온다.

## 무엇을 재나

| 묶음 | 지표 |
| --- | --- |
| 프레임 | FPS(평균·최저 1%·최저 5%), 간격 분위수, 느린 프레임 수, longtask |
| 엔진 | `frame()` `project()` `pickRepresentatives()` `residentCount()` `countInView()` |
| 그리기 | `drawImage` 호출·시간, 종류별 분해, 상태 변경 횟수, 경로 연산 |
| React | 스냅샷 통지 횟수 (줌 중 `zoomK`/`pressure` 로 인한 리렌더 확인) |
| rAF | 동시 활성 루프 수 (지도 1 + 미니맵 1 + 반응 N) |
| 상태 | N, residentCount, viewportCount, visible, chosen, layer, cam.s, W/H, DPR … |
| 메모리 | JS 힙 사용량 |
| 로딩 | TTFB, FCP, LCP, CLS, JS·이미지 전송량, `/api/map/songs` 크기·시간 |
| 환경 | 커밋, 빌드 모드, 브라우저, 화면 크기, DPR, 패널 표시 여부, 목/실데이터 |

그리기 구간은 **스프라이트 원본 크기**로 분류한다 (48 별 / 208 성운 / 104 앨범커버 / 76 친구아바타).
`drawMap` 의 호출 순서에 기대지 않으므로 렌더 코드가 바뀌어도 안 깨지고, 모르는 크기가 나오면
`분류안된_소스크기` 에 모아 경고한다.

## 숫자를 읽을 때 주의

- **상태 없이 시간만 보면 안 된다.** 같은 `4.9ms` 라도 화면 안 곡이 1000개인지 300개인지에 따라
  의미가 정반대다. N·viewportCount 를 항상 같이 본다.
- **관찰자 효과가 있다.** `drawImage` 를 감싸서 재므로 실제보다 부풀려진다.
  리포트의 `관찰자효과.보정후_그리기_프레임당_ms` 가 계측 안 했을 때에 가까운 값이다.
- **개발 빌드는 프로덕션보다 느리다.** 빌드 모드를 비고에 적는다.
- **DPR 을 같이 본다.** DPR 2 면 실제 그리는 픽셀이 4배다.
- 리포트의 `검증` 배열에 경고가 있으면 그 측정은 그대로 믿지 않는다.

## 자동 기록 라우트

`../src/app/dev-perf-log/route.ts` 는 **개발 전용**이다. 파일을 쓰는 엔드포인트가 배포 서버에
열려 있으면 안 되므로:

- `NODE_ENV=production` 이면 GET·POST 모두 **404** (`next start` 로 검증함)
- 쓰는 파일은 `PERF-LOG.md` **하나로 고정** — 요청으로 경로를 바꿀 수 없다
- `PERF-LOG.md` 의 마커(`<!-- /PERF_ROWS -->` / `<!-- /PERF_DETAILS -->`)가 없으면 거부한다.
  **그 두 줄을 지우지 않는다.**

목 API(`src/app/bff/`)는 실제 백엔드가 붙으면 통째로 사라지므로 이 라우트는 그 바깥에 둔다.
Next 는 `_` 로 시작하는 폴더를 라우팅에서 제외하므로 폴더명이 `dev-perf-log` 다.
