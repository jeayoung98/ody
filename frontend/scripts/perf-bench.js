/**
 * ODY 프론트엔드 성능 계측 (S15P21A405-215)
 *
 * 쓰는 법: `npm run dev` 로 지도를 띄운 뒤 브라우저 콘솔에 이 파일 내용을 통째로 붙여넣는다.
 * 앱 소스는 건드리지 않는다 — 캔버스 컨텍스트와 엔진을 런타임에 가로채서 잰다.
 *
 * ⚠️ 브라우저 탭이 숨겨져 있으면 requestAnimationFrame 이 멈춘다. 프레임 지표가 전부 0 이면
 *    탭을 앞으로 꺼낸 뒤 다시 돌린다.
 *
 * 결과: PERF-LOG.md 에 붙여넣을 마크다운 한 줄 + 상세 JSON (window.__odyPerf 에도 남는다)
 */
(async () => {
  const DURATION_MS = 5000;

  /** drawImage 소스 캔버스의 한 변 길이 → 무엇을 그린 것인가. sprites.ts 의 원본 크기와 맞춘다 */
  const SPRITE_KIND = { 48: "별", 208: "성운", 104: "앨범커버", 76: "친구아바타" };

  const num = (v, d = 2) => (typeof v === "number" && isFinite(v) ? +v.toFixed(d) : null);
  const pct = (a, b) => (b ? +((a / b) * 100).toFixed(1) : null);
  const quantile = (sorted, p) =>
    sorted.length ? num(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]) : null;

  // ── 0. 엔진·캔버스 찾기 ────────────────────────────────────────────────
  const engine = window.__odyEngine;
  if (!engine) {
    console.error("[perf] window.__odyEngine 이 없다. 개발 빌드로 지도 화면(/)을 연 뒤 다시 실행한다.");
    return;
  }
  // 지도 캔버스 = 가장 큰 것 (미니맵과 구분)
  const canvas = [...document.querySelectorAll("canvas")].reduce((a, b) =>
    a.width * a.height >= b.width * b.height ? a : b,
  );
  const ctx = canvas.getContext("2d"); // 같은 컨텍스트 객체가 돌아온다 — 앱이 쓰는 그것
  if (!ctx) {
    console.error("[perf] 2D 컨텍스트를 못 잡았다.");
    return;
  }

  // ── 1. 캔버스 가로채기 ─────────────────────────────────────────────────
  const draw = { calls: 0, totalMs: 0, byKind: {}, unknownSizes: {} };
  const stateSets = { globalAlpha: 0, globalCompositeOperation: 0, fillStyle: 0, strokeStyle: 0, font: 0 };
  const pathOps = { fill: 0, stroke: 0, fillText: 0, beginPath: 0 };

  const origDrawImage = ctx.drawImage;
  ctx.drawImage = function (src, ...rest) {
    const t0 = performance.now();
    const r = origDrawImage.call(this, src, ...rest);
    const dt = performance.now() - t0;
    const side = src && (src.width ?? 0);
    const kind = SPRITE_KIND[side] ?? "기타";
    if (kind === "기타" && side) draw.unknownSizes[side] = (draw.unknownSizes[side] || 0) + 1;
    const b = (draw.byKind[kind] ??= { calls: 0, ms: 0 });
    b.calls++;
    b.ms += dt;
    draw.calls++;
    draw.totalMs += dt;
    return r;
  };

  // 상태 setter 는 프로토타입의 accessor 를 인스턴스 own property 로 덮어써서 센다
  const proto = Object.getPrototypeOf(ctx);
  const restoreProps = [];
  for (const prop of Object.keys(stateSets)) {
    const d = Object.getOwnPropertyDescriptor(proto, prop);
    if (!d?.set) continue;
    Object.defineProperty(ctx, prop, {
      configurable: true,
      get() {
        return d.get.call(this);
      },
      set(v) {
        stateSets[prop]++;
        d.set.call(this, v);
      },
    });
    restoreProps.push(prop);
  }

  const origPathFns = {};
  for (const fn of Object.keys(pathOps)) {
    if (typeof ctx[fn] !== "function") continue;
    origPathFns[fn] = ctx[fn];
    ctx[fn] = function (...a) {
      pathOps[fn]++;
      return origPathFns[fn].apply(this, a);
    };
  }

  // ── 2. React 통지 횟수 (엔진 → 스토어) ─────────────────────────────────
  let notifyCount = 0;
  const origListener = engine.snapListener;
  if (typeof origListener === "function") {
    engine.snapListener = function (...a) {
      notifyCount++;
      return origListener.apply(this, a);
    };
  }

  // ── 3. rAF 활성 루프 수 ────────────────────────────────────────────────
  let rafRegistrations = 0;
  const origRaf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) {
    rafRegistrations++;
    return origRaf(cb);
  };

  // ── 4. longtask ────────────────────────────────────────────────────────
  const longtasks = [];
  let ltObserver = null;
  try {
    ltObserver = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) longtasks.push(num(e.duration, 1));
    });
    ltObserver.observe({ entryTypes: ["longtask"] });
  } catch {
    /* 미지원 브라우저 */
  }

  // ── 5. HUD 주입 (새로고침하면 사라진다) ────────────────────────────────
  document.getElementById("ody-perf-hud")?.remove();
  const hud = document.createElement("div");
  hud.id = "ody-perf-hud";
  hud.style.cssText =
    "position:fixed;top:8px;left:8px;z-index:2147483647;padding:6px 10px;border-radius:6px;" +
    "background:rgba(0,0,0,.78);color:#8ef;font:12px/1.5 ui-monospace,Menlo,monospace;pointer-events:none;white-space:pre";
  hud.textContent = "측정 중…";
  document.body.appendChild(hud);

  // ── 6. 프레임 수집 ─────────────────────────────────────────────────────
  const gaps = [];
  let frames = 0;
  let last = 0;
  const hidden0 = document.hidden;
  const t0 = performance.now();

  await new Promise((resolve) => {
    const hardStop = setTimeout(resolve, DURATION_MS + 1500); // 탭이 숨겨져 rAF 가 안 돌아도 끝난다
    const tick = (t) => {
      if (last) gaps.push(t - last);
      last = t;
      frames++;
      if (frames % 10 === 0) {
        const el = performance.now() - t0;
        hud.textContent = `FPS ${num(frames / (el / 1000), 1)}  ·  draw ${num(draw.totalMs / frames)}ms/f`;
      }
      if (performance.now() - t0 < DURATION_MS) origRaf(tick);
      else {
        clearTimeout(hardStop);
        resolve();
      }
    };
    origRaf(tick);
  });

  const elapsedMs = performance.now() - t0;

  // ── 7. 해제 ────────────────────────────────────────────────────────────
  ctx.drawImage = origDrawImage;
  for (const p of restoreProps) delete ctx[p];
  for (const fn of Object.keys(origPathFns)) ctx[fn] = origPathFns[fn];
  if (typeof origListener === "function") engine.snapListener = origListener;
  window.requestAnimationFrame = origRaf;
  ltObserver?.disconnect();

  // ── 8. 엔진 함수 개별 계측 (rAF 와 무관하게 동기로 잰다) ───────────────
  const benchFn = (label, fn, iters = 300) => {
    try {
      for (let i = 0; i < 30; i++) fn();
      const s = performance.now();
      for (let i = 0; i < iters; i++) fn();
      return num((performance.now() - s) / iters, 4);
    } catch (err) {
      return `ERR: ${err.message}`;
    }
  };
  let fakeNow = performance.now();
  const engineBench = {
    "frame()": benchFn("frame", () => {
      fakeNow += 16.7;
      engine.frame(fakeNow);
    }),
    "project()": benchFn("project", () => engine.project()),
    "pickRepresentatives()": benchFn("pick", () => engine.pickRepresentatives()),
    "residentCount()": benchFn("resident", () => engine.residentCount()),
    "countInView()": benchFn("countInView", () => engine.countInView()),
  };

  // ── 9. 관찰자 효과 (래퍼 자체 비용) ────────────────────────────────────
  const scratch = document.createElement("canvas");
  scratch.width = scratch.height = 256;
  const sg = scratch.getContext("2d");
  const spr = document.createElement("canvas");
  spr.width = spr.height = 48;
  const ITER = 20000;
  let s0 = performance.now();
  for (let i = 0; i < ITER; i++) sg.drawImage(spr, 0, 0, 8, 8);
  const bare = (performance.now() - s0) / ITER;
  let sink = 0; // 래퍼가 하는 일(시간 재서 누적)을 그대로 흉내 내야 오버헤드가 제대로 잡힌다
  const wrapped = function (src, ...rest) {
    const a = performance.now();
    const r = sg.drawImage(src, ...rest);
    sink += performance.now() - a;
    return r;
  };
  s0 = performance.now();
  for (let i = 0; i < ITER; i++) wrapped(spr, 0, 0, 8, 8);
  const withWrap = (performance.now() - s0) / ITER;
  const overheadPerCall = Math.max(0, withWrap - bare);

  // ── 10. 로딩·네트워크·메모리 ───────────────────────────────────────────
  const nav = performance.getEntriesByType("navigation")[0];
  const res = performance.getEntriesByType("resource");
  const sumBytes = (arr) => arr.reduce((n, r) => n + (r.transferSize || 0), 0);
  const js = res.filter((r) => r.name.endsWith(".js") || r.name.includes("/_next/static/chunks/"));
  const imgs = res.filter((r) => r.initiatorType === "img" || /\.(png|jpe?g|webp|avif|gif|svg)(\?|$)/.test(r.name));
  const songsReq = res.filter((r) => r.name.includes("/api/map/songs")).at(-1);
  const paint = Object.fromEntries(performance.getEntriesByType("paint").map((p) => [p.name, num(p.startTime)]));

  const vitals = {};
  try {
    const lcp = performance.getEntriesByType("largest-contentful-paint").at(-1);
    if (lcp) vitals.LCP = num(lcp.startTime);
    let cls = 0;
    for (const e of performance.getEntriesByType("layout-shift")) if (!e.hadRecentInput) cls += e.value;
    vitals.CLS = num(cls, 4);
  } catch {
    /* 미지원 */
  }

  // ── 11. 집계 ───────────────────────────────────────────────────────────
  gaps.sort((a, b) => a - b);
  const worst = [...gaps].sort((a, b) => b - a);
  const fps = frames ? num(frames / (elapsedMs / 1000), 1) : 0;
  const drawPerFrame = frames ? num(draw.totalMs / frames) : null;
  const enginePerFrame = typeof engineBench["frame()"] === "number" ? engineBench["frame()"] : 0;
  const measuredJs = (drawPerFrame || 0) + enginePerFrame;
  const medianGap = quantile(gaps, 0.5);
  const unaccounted = medianGap != null ? num(medianGap - measuredJs) : null;

  const byKind = {};
  for (const [k, v] of Object.entries(draw.byKind)) {
    byKind[k] = {
      호출: v.calls,
      "프레임당_호출": frames ? num(v.calls / frames, 1) : null,
      "총_ms": num(v.ms),
      "프레임당_ms": frames ? num(v.ms / frames, 3) : null,
      "그리기중_비중_%": pct(v.ms, draw.totalMs),
    };
  }

  const report = {
    환경: {
      측정일시: new Date().toISOString(),
      URL: location.href,
      빌드모드: document.querySelector("script[src*='/_next/static/development/']") ? "dev(추정)" : "unknown",
      브라우저: navigator.userAgent,
      화면: `${window.innerWidth}x${window.innerHeight}`,
      DPR: window.devicePixelRatio,
      캔버스픽셀: `${canvas.width}x${canvas.height}`,
      탭_숨김이었나: hidden0,
      커밋: "???", // git rev-parse --short HEAD 로 채운다
      번들_gzip: "???", // npm run build 후 계산해 채운다
      데이터: "목/실 — 직접 표기",
    },
    프레임: {
      측정_초: num(elapsedMs / 1000),
      프레임수: frames,
      FPS: fps,
      "간격_중앙값_ms": medianGap,
      "간격_p90_ms": quantile(gaps, 0.9),
      "간격_p95_ms": quantile(gaps, 0.95),
      "간격_p99_ms": quantile(gaps, 0.99),
      "간격_최대_ms": quantile(gaps, 1),
      "최저1%_FPS": worst.length ? num(1000 / worst[Math.floor(worst.length * 0.01)], 1) : null,
      "최저5%_FPS": worst.length ? num(1000 / worst[Math.floor(worst.length * 0.05)], 1) : null,
      "느린프레임_16.7ms초과": gaps.filter((g) => g > 16.7).length,
      "느린프레임_33ms초과": gaps.filter((g) => g > 33).length,
      "느린프레임_50ms초과": gaps.filter((g) => g > 50).length,
      longtask_개수: longtasks.length,
      "longtask_총_ms": num(longtasks.reduce((a, b) => a + b, 0)),
      longtask_최대: longtasks.length ? Math.max(...longtasks) : null,
    },
    그리기: {
      "총_drawImage_호출": draw.calls,
      "프레임당_drawImage": frames ? num(draw.calls / frames, 1) : null,
      "프레임당_ms": drawPerFrame,
      "예산_16.7ms_대비_%": pct(drawPerFrame, 16.7),
      종류별: byKind,
      분류안된_소스크기: draw.unknownSizes,
      상태변경: {
        ...stateSets,
        "프레임당_globalAlpha": frames ? num(stateSets.globalAlpha / frames, 1) : null,
      },
      경로연산: pathOps,
    },
    엔진: engineBench,
    React: {
      스냅샷_통지_횟수: notifyCount,
      "프레임당_통지": frames ? num(notifyCount / frames, 3) : null,
      비고: "줌 중에 이 값이 프레임당 1에 가까우면 zoomK/pressure 때문에 매 프레임 리렌더가 발생하는 것",
    },
    rAF: {
      측정중_등록횟수: rafRegistrations,
      "프레임당_등록": frames ? num(rafRegistrations / frames, 2) : null,
      비고: "프레임당 등록 수 ≈ 동시에 도는 루프 수 (지도 1 + 미니맵 1 + 반응 N)",
    },
    상태: {
      N: engine.N,
      residentCount: engine.residentCount(),
      viewportCount: engine.viewportCount,
      visible: engine.visible?.length,
      chosen: engine.chosen?.size,
      layer: engine.layer,
      "cam.s": num(engine.cam?.s, 1),
      zoomK: num(engine.zoomK?.(), 3),
      "W/H": `${Math.round(engine.W)}x${Math.round(engine.H)}`,
      친구수: engine.friends?.length ?? engine.visFriends?.length,
      별자리곡수: engine.constellation?.ids?.length ?? 0,
      프로브활성: !!engine.probe,
    },
    메모리: {
      "usedJSHeap_MB": performance.memory ? num(performance.memory.usedJSHeapSize / 1048576) : "미지원(Chrome만)",
      "totalJSHeap_MB": performance.memory ? num(performance.memory.totalJSHeapSize / 1048576) : null,
    },
    로딩: {
      TTFB_ms: nav ? num(nav.responseStart) : null,
      DOMContentLoaded_ms: nav ? num(nav.domContentLoadedEventEnd) : null,
      load_ms: nav ? num(nav.loadEventEnd) : null,
      ...paint,
      ...vitals,
      JS_요청수: js.length,
      "JS_전송_KB": num(sumBytes(js) / 1024),
      이미지_요청수: imgs.length,
      "이미지_전송_KB": num(sumBytes(imgs) / 1024),
      "map_songs_KB": songsReq ? num((songsReq.transferSize || songsReq.encodedBodySize || 0) / 1024) : null,
      "map_songs_ms": songsReq ? num(songsReq.duration) : null,
    },
    관찰자효과: {
      "래퍼_1회당_ms": num(overheadPerCall, 5),
      "프레임당_추정_오버헤드_ms": frames ? num((draw.calls / frames) * overheadPerCall, 3) : null,
      "보정후_그리기_프레임당_ms": frames ? num((draw.totalMs - (draw.calls * overheadPerCall)) / frames) : null,
      "벤치_누적_ms": num(sink), // 래퍼가 실제로 재고 누적한 시간 (오버헤드 계산의 원자료)
      비고: "그리기 수치에서 오버헤드를 빼면 계측 안 했을 때의 값에 가깝다",
    },
    검증: [],
  };

  // ── 12. 자기 검증 — 안 맞으면 경고 ────────────────────────────────────
  if (frames === 0) {
    report.검증.push(
      `⚠️ 프레임이 0 — requestAnimationFrame 이 돌지 않았다. 프레임 지표는 전부 무효다. ` +
        `(document.hidden=${hidden0}, visibilityState=${document.visibilityState}) ` +
        `창이 실제로 화면에 보이는 상태여야 한다. visibilityState 가 "visible" 이어도 창이 가려져 있거나 ` +
        `화면에 합성되지 않으면(내장 미리보기 패널, 백그라운드 창 등) rAF 는 멈춘다. ` +
        `일반 브라우저 창을 앞에 두고 다시 실행한다. 나머지 지표(엔진·로딩·메모리·상태)는 유효하다.`,
    );
  }
  const kindSum = Object.values(draw.byKind).reduce((a, b) => a + b.ms, 0);
  if (draw.totalMs > 0 && Math.abs(kindSum - draw.totalMs) / draw.totalMs > 0.01) {
    report.검증.push(`⚠️ 종류별 합(${num(kindSum)}ms)과 총 그리기(${num(draw.totalMs)}ms)가 어긋난다.`);
  }
  if (Object.keys(draw.unknownSizes).length) {
    report.검증.push(
      `⚠️ 분류 안 된 스프라이트 크기: ${JSON.stringify(draw.unknownSizes)} — sprites.ts 가 바뀌었을 수 있다. SPRITE_KIND 를 갱신한다.`,
    );
  }
  if (unaccounted != null && medianGap > 0 && unaccounted / medianGap > 0.6) {
    report.검증.push(
      `ℹ️ 프레임 간격 ${medianGap}ms 중 계측된 JS 는 ${num(measuredJs)}ms 뿐. 나머지 ${unaccounted}ms 는 합성·브라우저 작업이거나 미계측 구간이다.`,
    );
  }
  if (!report.검증.length) report.검증.push("✅ 이상 없음");

  report.프레임.미계측_시간_ms = unaccounted;

  // ── 13. 출력 ───────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const row = `| ${today} | ??? | ${engine.N} | ${fps} | ${drawPerFrame}ms | ${enginePerFrame}ms | ???KB | ${hidden0 ? "탭 숨김 — 프레임 지표 무효" : ""} |`;

  hud.textContent = `FPS ${fps}\ndraw ${drawPerFrame}ms/f\nN ${engine.N}`;
  window.__odyPerf = report;

  console.log("%c=== ODY 성능 측정 ===", "font-weight:bold;font-size:14px");
  console.log(report);
  for (const v of report.검증) console.log(v);
  console.log("\n%cPERF-LOG.md 에 붙여넣을 한 줄 (??? 는 커밋·번들로 채운다):", "font-weight:bold");
  console.log(row);
  console.log("\n%c상세 JSON (details 블록에 넣는다):", "font-weight:bold");
  console.log(JSON.stringify(report, null, 2));
  console.log("\nwindow.__odyPerf 에도 남아 있다. HUD 는 새로고침하면 사라진다.");

  return report;
})();
