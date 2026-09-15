"use client";

import { useEffect, useState } from "react";
import { getMapEngine } from "@/components/map/engine/engine-registry";

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** 고리를 두를지. 지도처럼 화면만 한 자리는 두르면 화면 테두리가 돼서 안 두른다 */
  ring: boolean;
  /** 이 자리 밖을 어둡게 덮고 막을지 */
  dim: boolean;
}

/** 요소 둘레 여백. 고리가 버튼에 딱 붙으면 눌러야 할 것이 뭔지 덜 읽힌다 */
const PAD = 9;

interface Targets {
  spotlight: readonly string[];
  ringOnly: readonly string[];
}

/**
 * 자리를 찾는다. 앞에서부터 **먼저 찾아지는 것**을 쓴다 — 여정처럼 한 단계 안에서 조작 자리가
 * 옮겨 다니는 경우(레일 버튼 → 패널 → 만들기 상자)를 한 목록으로 적기 위해서다.
 *
 * `"map"` 만 DOM 요소가 아니다. 캔버스는 화면 전체를 덮으므로 그대로 쓰면 아무것도 안
 * 어두워진다 — 엔진이 이미 아는 "패널·HUD 를 뺀 지도가 실제로 보이는 사각형" 을 쓴다.
 */
function find(targets: readonly string[], dim: boolean): Rect | null {
  for (const t of targets) {
    if (t === "map") {
      const c = document.querySelector("canvas")?.getBoundingClientRect();
      const f = getMapEngine()?.freeRect();
      if (!c || !f) continue;
      return { x0: c.left + f.x0, y0: c.top + f.y0, x1: c.left + f.x1, y1: c.top + f.y1, ring: false, dim };
    }
    const r = document.querySelector(`[data-tutorial="${t}"]`)?.getBoundingClientRect();
    if (r?.width && r.height) return { x0: r.left - PAD, y0: r.top - PAD, x1: r.right + PAD, y1: r.bottom + PAD, ring: true, dim };
  }
  return null;
}

/** 고리만 두르는 자리가 떠 있으면 그쪽이 이긴다 — 어둠막을 걷는 것이 요점이라 */
const measure = ({ spotlight, ringOnly }: Targets) => find(ringOnly, false) ?? find(spotlight, true);

const same = (a: Rect | null, b: Rect | null) =>
  a && b ? a.x0 === b.x0 && a.y0 === b.y0 && a.x1 === b.x1 && a.y1 === b.y1 && a.dim === b.dim : a === b;

/**
 * 스포트라이트 (S15P21A405-347). 이 단계에서 조작할 자리만 남기고 화면을 덮는다.
 *
 * 구멍 뚫린 한 장이 아니라 **사각형 네 장**이다. 구멍 자리에는 아무것도 없으므로 클릭도 휠도
 * 그대로 아래(지도·버튼)로 간다 — 이벤트를 다시 쏘아 주는 장치가 필요 없다. 어두운 네 장은
 * `pointer-events` 가 살아 있어 그 밖의 조작을 그대로 막는다.
 *
 * 다음 단계로 넘기는 것은 여기서 하지 않는다. 밝힌 자리를 진짜로 조작하면 그 컴포넌트가
 * 이미 `complete(task)` 를 부른다 (지도 휠·별 클릭·주변 탐색 버튼·출발곡·도착곡·경로 만들기).
 */
export default function TutorialSpotlight({ spotlight, ringOnly }: Targets) {
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    // ponytail: 250ms 폴링. 패널이 열고 닫히며 자리가 **움직이는데** ResizeObserver 는 크기만 본다
    const tick = () => {
      const next = measure({ spotlight, ringOnly });
      setRect((prev) => (same(prev, next) ? prev : next));
    };
    tick();
    const id = window.setInterval(tick, 250);
    window.addEventListener("resize", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", tick);
    };
  }, [spotlight, ringOnly]);

  const dim = "pointer-events-auto fixed bg-void/80 backdrop-blur-[2px]";
  // 밝힐 자리를 못 찾으면 통째로 덮는다
  if (!rect) return <div className={`${dim} inset-0`} />;

  const w = rect.x1 - rect.x0;
  const h = rect.y1 - rect.y0;
  return (
    <>
      {rect.dim && (
        <>
          <div className={dim} style={{ left: 0, right: 0, top: 0, height: rect.y0 }} />
          <div className={dim} style={{ left: 0, right: 0, top: rect.y1, bottom: 0 }} />
          <div className={dim} style={{ left: 0, top: rect.y0, width: rect.x0, height: h }} />
          <div className={dim} style={{ left: rect.x1, right: 0, top: rect.y0, height: h }} />
        </>
      )}
      {/* 고리. 클릭을 가로채면 안 되므로 이벤트를 통과시킨다 */}
      {rect.ring && (
        <div
          className="pointer-events-none fixed border border-teal/60 shadow-glow-teal"
          // 알약 버튼부터 세로로 긴 패널까지 대상이 제각각이라 짧은 변에 맞춰 둥글린다
          style={{ left: rect.x0, top: rect.y0, width: w, height: h, borderRadius: Math.min(26, w / 2, h / 2) }}
        >
          <i className="animate-tbeat absolute -inset-0.5 block rounded-[inherit] border-2 border-teal" />
        </div>
      )}
    </>
  );
}
