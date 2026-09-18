/**
 * ODY 프론트엔드 성능 계측 (S15P21A405-215)
 *
 * 쓰는 법·지표 설명·주의사항은 **scripts/README.md** 를 본다.
 * 요약: `npm run dev` 로 지도를 띄우고, 창이 실제로 화면에 보이는 상태에서
 * 이 파일 내용을 콘솔에 통째로 붙여넣는다. 5초간 잰다.
 *
 * 앱 소스는 건드리지 않는다 — 캔버스 컨텍스트와 window.__odyEngine 을 런타임에 가로챈다.
 *
 * ⚠️ 창이 가려져 있으면 requestAnimationFrame 이 멈춰 프레임 지표가 전부 0 이 된다.
 *    그때는 스크립트가 경고를 띄운다. 나머지 지표는 그 상태에서도 유효하다.
 *
 * 결과는 ../PERF-LOG.md 에 자동으로 기록된다(개발 전용 라우트 /dev-perf-log).
 * 실패하면 붙여넣을 마크다운 한 줄과 상세 JSON 을 콘솔에 출력한다.
 * window.__odyPerf 에도 남는다.
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
  /*
   * 지도 캔버스 = 화면에서 제일 크게 그려진 것 (미니맵과 구분).
   *
   * **`canvas.width`(백스토어) 가 아니라 렌더 크기로 고른다** (S15P21A405-438).
   * 리사이즈가 아직 안 돌았으면 백스토어가 둘 다 기본값 300x150 이라 어느 쪽이 지도인지
   * 구분이 안 되고, `reduce` 가 그냥 앞의 것을 집는다. 화면에 잡힌 크기는 그럴 일이 없다.
   */
  const area = (c) => {
    const r = c.getBoundingClientRect();
    return r.width * r.height;
  };
  // 지도 캔버스 = 가장 큰 것 (미니맵과 구분)
  const canvas = [...document.querySelectorAll("canvas")].reduce((a, b) =>
    area(a) >= area(b) ? a : b,
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

  // ── 1-b. 미니맵 캔버스 가로채기 (S15P21A405-438) ───────────────────────
  /*
   * 지금까지 계측은 **제일 큰 캔버스(지도) 하나만** 봤다. 그래서 미니맵 비용이 한 번도
   * 잡히지 않았다 — PERF-LOG 의 `fillStyle` 이 프레임당 59회뿐인 것이 그 증거다
   * (미니맵이 잡혔다면 별 하나당 한 번씩 세팅하므로 1,000대여야 한다).
   *
   * 하필 미니맵이 문제인 이유: **전체 조망이라 뷰포트 컬링이 원천적으로 불가능하다.**
   * 화면 밖이라는 개념이 없어서 매 프레임 O(N) 평균 계산 한 번 + O(N) 그리기 한 번을 돈다.
   * 메인 지도는 화면 밖 별을 걸러 `drawImage` 를 건너뛰므로 **화면 안 개수**에 비례하지만,
   * 미니맵은 **N 그 자체**에 비례한다 — 곡 수를 올릴 때 유일하게 선형으로 커지는 그리기다.
   *
   * 미니맵은 스프라이트가 아니라 `fillRect` 로 점을 찍으므로 `drawImage` 래퍼에 안 걸린다.
   * 그래서 여기서 따로 센다.
   */
  const miniCanvases = [...document.querySelectorAll("canvas")].filter((c) => c !== canvas);
  const mini = { fillRect: 0, ms: 0, fillStyle: 0, canvases: miniCanvases.length };
  const miniRestore = [];
  for (const mc of miniCanvases) {
    const mctx = mc.getContext("2d");
    if (!mctx) continue;
    const origFillRect = mctx.fillRect;
    mctx.fillRect = function (...a) {
      const s0 = performance.now();
      const r = origFillRect.apply(this, a);
      mini.ms += performance.now() - s0;
      mini.fillRect++;
      return r;
    };
    const md = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(mctx), "fillStyle");
    if (md?.set) {
      Object.defineProperty(mctx, "fillStyle", {
        configurable: true,
        get() {
          return md.get.call(this);
        },
        set(v) {
          mini.fillStyle++;
          return md.set.call(this, v);
        },
      });
    }
    miniRestore.push(() => {
      mctx.fillRect = origFillRect;
      delete mctx.fillStyle;
    });
  }

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
  for (const fn of miniRestore) fn();
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
    /*
     * 미니맵은 **메인 지도와 따로 센다** (S15P21A405-438).
     * 전체 조망이라 뷰포트 컬링이 원천적으로 불가능해서, 화면 안 개수가 아니라 **N 그 자체**에
     * 비례한다 — 곡 수를 올릴 때 유일하게 선형으로 커지는 그리기다.
     */
    미니맵: {
      캔버스수: mini.canvases,
      "총_fillRect": mini.fillRect,
      "프레임당_fillRect": frames ? num(mini.fillRect / frames, 1) : null,
      "프레임당_ms": frames ? num(mini.ms / frames) : null,
      "fillStyle_변경": mini.fillStyle,
      비고: "컬링 없음 — 화면 안 개수가 아니라 N 에 비례. step 은 N>3000 에서 2",
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
  /** 못 잰 값은 빈칸이 아니라 "미측정" 으로 남긴다 — 나중에 0 과 헷갈리지 않게 */
  const cell = (v, unit = "") => (v == null ? "미측정" : `${v}${unit}`);
  const budget = report.그리기["예산_16.7ms_대비_%"];
  const note = frames === 0 ? "rAF 미동작 — 프레임·그리기 무효" : "";
  const row =
    `| ${today} | ??? | ${engine.N} | ${frames === 0 ? "미측정" : fps} | ${cell(drawPerFrame, "ms")} | ` +
    `${cell(frames === 0 ? null : budget, "%")} | ${cell(enginePerFrame, "ms")} | ???KB | ${note} |`;

  // ── 사람이 읽는 상세 (마크다운 표). 원본 JSON 은 그 아래 접어둔다 ────────
  const t = (rows) => rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  const kindRows = Object.entries(byKind).map(([k, v]) => [
    k,
    v["프레임당_호출"],
    cell(v["프레임당_ms"], "ms"),
    cell(v["그리기중_비중_%"], "%"),
  ]);
  const f = report.프레임;
  const st = report.상태;
  const ld = report.로딩;
  const env = report.환경;

  const detailMd = [
    frames === 0
      ? "> ⚠️ **rAF 가 돌지 않아 프레임·그리기 지표는 무효다.** 엔진·로딩·메모리·상태만 유효하다."
      : `**FPS ${fps}** · 그리기 ${cell(drawPerFrame, "ms")}/프레임 (예산의 ${cell(budget, "%")}) · ` +
        `느린 프레임 33ms↑ ${f["느린프레임_33ms초과"]}개 · longtask ${f.longtask_개수}개`,
    "",
    "### 프레임",
    "| FPS | 최저 1% | 최저 5% | 간격 중앙값 | p95 | 최대 | 16.7ms↑ | 33ms↑ | 미계측 시간 |",
    "|---|---|---|---|---|---|---|---|---|",
    t([
      [
        fps,
        cell(f["최저1%_FPS"]),
        cell(f["최저5%_FPS"]),
        cell(f["간격_중앙값_ms"], "ms"),
        cell(f["간격_p95_ms"], "ms"),
        cell(f["간격_최대_ms"], "ms"),
        f["느린프레임_16.7ms초과"],
        f["느린프레임_33ms초과"],
        cell(f.미계측_시간_ms, "ms"),
      ],
    ]),
    "",
    "### 그리기 — 종류별",
    "| 종류 | 프레임당 호출 | 프레임당 ms | 그리기 중 비중 |",
    "|---|---|---|---|",
    t(kindRows),
    "",
    `합계 **${draw.calls ? report.그리기["프레임당_drawImage"] : 0}회/프레임**, ${cell(drawPerFrame, "ms")} ` +
      `(관찰자 효과 보정 후 ${cell(report.관찰자효과["보정후_그리기_프레임당_ms"], "ms")})`,
    "",
    "### 미니맵 (지도와 별개 — 컬링이 없어 N 에 정비례)",
    "| 캔버스 | 프레임당 fillRect | 프레임당 ms | fillStyle 변경 |",
    "|---|---|---|---|",
    t([
      [
        report.미니맵.캔버스수,
        report.미니맵["프레임당_fillRect"] ?? "미측정",
        cell(report.미니맵["프레임당_ms"], "ms"),
        report.미니맵["fillStyle_변경"],
      ],
    ]),
    "",
    "### 캔버스 상태 변경 (프레임당)",
    "| globalAlpha | compositeOp | fillStyle | strokeStyle | font |",
    "|---|---|---|---|---|",
    t([
      [
        report.그리기.상태변경["프레임당_globalAlpha"] ?? "미측정",
        frames ? num(stateSets.globalCompositeOperation / frames, 1) : "미측정",
        frames ? num(stateSets.fillStyle / frames, 1) : "미측정",
        frames ? num(stateSets.strokeStyle / frames, 1) : "미측정",
        frames ? num(stateSets.font / frames, 1) : "미측정",
      ],
    ]),
    "",
    "### 엔진 (1회 호출당 ms)",
    "| frame() | project() | pickRepresentatives() | residentCount() | countInView() |",
    "|---|---|---|---|---|",
    t([
      [
        engineBench["frame()"],
        engineBench["project()"],
        engineBench["pickRepresentatives()"],
        engineBench["residentCount()"],
        engineBench["countInView()"],
      ],
    ]),
    "",
    "### 상태 · React · rAF",
    "| N | 상주 | 화면 안 | visible | chosen | layer | cam.s | 친구 | React 통지/프레임 | rAF 루프/프레임 |",
    "|---|---|---|---|---|---|---|---|---|---|",
    t([
      [
        st.N,
        st.residentCount,
        st.viewportCount,
        st.visible,
        st.chosen,
        st.layer,
        st["cam.s"],
        st.친구수,
        cell(report.React["프레임당_통지"]),
        cell(report.rAF["프레임당_등록"]),
      ],
    ]),
    "",
    "### 로딩 · 네트워크",
    "| TTFB | FCP | LCP | CLS | JS 요청 | JS 전송 | 이미지 | map/songs |",
    "|---|---|---|---|---|---|---|---|",
    t([
      [
        cell(ld.TTFB_ms, "ms"),
        cell(ld["first-contentful-paint"], "ms"),
        cell(ld.LCP, "ms"),
        cell(ld.CLS),
        ld.JS_요청수,
        cell(ld["JS_전송_KB"], "KB"),
        `${ld.이미지_요청수}건 / ${cell(ld["이미지_전송_KB"], "KB")}`,
        `${cell(ld["map_songs_KB"], "KB")} / ${cell(ld["map_songs_ms"], "ms")}`,
      ],
    ]),
    "",
    "### 환경",
    "| 화면 | 캔버스 픽셀 | DPR | 빌드 | 힙 | 데이터 |",
    "|---|---|---|---|---|---|",
    t([
      [
        `${env.화면} (engine ${st["W/H"]})`,
        env.캔버스픽셀,
        env.DPR,
        env.빌드모드,
        cell(report.메모리["usedJSHeap_MB"], "MB"),
        env.데이터,
      ],
    ]),
    "",
    "### 검증",
    ...report.검증.map((v) => `- ${v}`),
  ].join("\n");

  hud.textContent = `FPS ${fps}\ndraw ${drawPerFrame}ms/f\nN ${engine.N}`;
  window.__odyPerf = report;

  // ── 14. PERF-LOG.md 에 자동 기록 (개발 전용 라우트) ────────────────────
  // 실패해도 측정 결과는 콘솔과 window.__odyPerf 에 그대로 남는다.
  let logged = null;
  try {
    const res = await fetch("/dev-perf-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        row,
        detail: report,
        markdown: detailMd,
        summary: `${today} · N=${engine.N} · ${frames === 0 ? "프레임 미측정" : `${fps}fps`} · 그리기 ${cell(drawPerFrame, "ms")}`,
      }),
    });
    logged = await res.json();
  } catch (err) {
    logged = { ok: false, error: String(err) };
  }

  console.log("%c=== ODY 성능 측정 ===", "font-weight:bold;font-size:14px");
  console.log(report);
  for (const v of report.검증) console.log(v);
  if (logged?.ok) {
    console.log(
      "%c✅ PERF-LOG.md 에 자동 기록됨%c — 커밋 해시와 번들 크기(???) 두 칸만 채우면 된다.",
      "font-weight:bold;color:#3c3",
      "",
    );
    console.log(`   ${logged.file}`);
  } else {
    console.warn("⚠️ 자동 기록 실패 — 아래 한 줄을 PERF-LOG.md 표에 직접 붙여넣는다.", logged?.error ?? logged);
    console.log(row);
    console.log("\n%c상세 JSON (details 블록에 넣는다):", "font-weight:bold");
    console.log(JSON.stringify(report, null, 2));
  }
  console.log("\nwindow.__odyPerf 에도 남아 있다. HUD 는 새로고침하면 사라진다.");

  return report;
})();
