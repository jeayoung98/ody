"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { Occlusion } from "@/components/map/engine/map-engine";
import { LAYER_AXES } from "@/constants";
import { useMapStore } from "@/stores/use-map-store";
import { getMapEngine } from "./engine/engine-registry";

/** 움직임이 멎고 이만큼 지나면 다시 연해진다 */
const CALM_MS = 1500;
/** 카메라를 들여다보는 주기. 이보다 촘촘할 이유가 없다 — 눈에 보이는 건 유리 세기뿐이다 */
const TICK_MS = 160;

/**
 * 화살표 모양 — 넓게 벌어진 큰 갈매기 하나와 그 품에 든 다이아몬드 (S15P21A405-719, 사용자 결정).
 * 아래를 가리키는 200×40 원본이고, 네 방향은 이걸 돌려 쓴다 — 그래야 네 변이 같은 크기로 대칭이 된다.
 * 꺾임을 얕게(넓은 각) 둔 건 사용자가 고른 3번 안이다. 모서리는 **아주 조금만**(화면 약 4px) 둥글린다 —
 * 0 두께로 모이는 끝은 너무 날카로웠고, 두께를 남겨 반원으로 닫은 끝은 너무 뭉툭했다(둘 다 사용자 피드백).
 * 그래서 날개 끝은 두께 2.5 로 뾰족하게 모으고, 꼭짓점·안쪽 홈만 원본 10 칸(≈6px) 폭으로 굴린다.
 * 가운데 두께는 약 11 — 17 은 굵고 9 는 가늘었다.
 * **호(A) 명령은 쓰지 않는다** — `scalePath` 가 숫자를 전부 곱해서 호의 플래그(0/1)까지 망가뜨린다.
 */
const WING =
  "M4,7.5 C42,12 80,24 95,35.5 Q100,39.5 105,35.5 C120,24 158,12 196,7.5 C198.5,7 198.5,5.3 196,5 C158,8 124,14 105,25 Q100,28 95,25 C76,14 42,8 4,5 C1.5,5.3 1.5,7 4,7.5 Z";
const DIAMOND = "M98.5,3.7 Q100,2 101.5,3.7 L106.6,9.4 Q108,11 106.6,12.6 L101.5,18.3 Q100,20 98.5,18.3 L93.4,12.6 Q92,11 93.4,9.4 Z";
const BASE_W = 200;
const BASE_H = 40;
/** 화면에 그릴 배율 — 원본 200px 을 128px 로. 0.56 은 얇은 날개라 유리가 안 읽혔고, 0.8 은 너무 컸다(사용자 피드백) */
const SCALE = 0.64;
const W = BASE_W * SCALE;
const H = BASE_H * SCALE;
/** 화살표 끝이 가림 영역(검색창·재생바·패널)에서 떨어지는 거리 */
const EDGE_GAP = 10;

/** `clip-path: path()` 는 px 좌표만 받고 배율을 따로 못 준다 — 숫자를 미리 곱해 둔다 */
const scalePath = (d: string) => d.replace(/-?\d+(\.\d+)?/g, (n) => String(+(Number(n) * SCALE).toFixed(2)));
const CLIP = `path('${scalePath(WING)} ${scalePath(DIAMOND)}')`;

/**
 * **유리 세기로만 두 단계를 둔다** (사용자 결정). 투명도(opacity)로 흐리게 하면 유리가 아니라 흐린 그림이 된다.
 * 평소엔 블러·밝기를 눌러 배경에 잠기고, 움직이면 블러·밝기·흰 틴트·테두리가 함께 올라온다.
 */
const GLASS = {
  // 움직일 때가 첫 안의 "평소" 세기다 — 그것도 강하다는 사용자 피드백으로 한 단계씩 내렸다
  calm: { filter: "blur(5px) saturate(1.05) brightness(1.1)", tint: "rgb(255 255 255 / 0.03)", rim: 0.06 },
  awake: { filter: "blur(8px) saturate(1.1) brightness(1.25)", tint: "rgb(255 255 255 / 0.07)", rim: 0.12 },
} as const;

type Dir = "up" | "down" | "left" | "right";
/** 원본은 아래를 가리킨다 */
const ROTATE: Record<Dir, number> = { down: 0, up: 180, left: 90, right: -90 };

function GlassArrow({ dir, awake }: { dir: Dir; awake: boolean }) {
  const g = awake ? GLASS.awake : GLASS.calm;
  const vertical = dir === "left" || dir === "right";
  const glass: CSSProperties = {
    width: W,
    height: H,
    clipPath: CLIP,
    background: g.tint,
    WebkitBackdropFilter: g.filter,
    backdropFilter: g.filter,
    transition: "backdrop-filter 500ms ease, -webkit-backdrop-filter 500ms ease, background-color 500ms ease",
  };
  return (
    // 돌려도 레이아웃 상자는 안 돈다 — 좌우 화살표는 상자 가로세로를 바꿔 두고 안에서 돌린다
    <span className="relative block shrink-0" style={{ width: vertical ? H : W, height: vertical ? W : H }}>
      <span className="absolute top-1/2 left-1/2" style={{ width: W, height: H, transform: `translate(-50%, -50%) rotate(${ROTATE[dir]}deg)` }}>
        <span className="absolute inset-0" style={glass} />
        {/* 테두리 — clip-path 는 border 를 못 따라가서 같은 경로를 선으로 한 번 더 긋는다. 배율과 무관하게 1px 로 옅게 */}
        <svg className="absolute inset-0 overflow-visible" width={W} height={H} viewBox={`0 0 ${BASE_W} ${BASE_H}`} aria-hidden>
          <path
            d={`${WING} ${DIAMOND}`}
            fill="none"
            stroke="white"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeOpacity={g.rim}
            style={{ transition: "stroke-opacity 500ms ease" }}
          />
        </svg>
      </span>
    </span>
  );
}

/**
 * 지도 네 가장자리의 축 라벨 (S15P21A405-358).
 *
 * 축을 알 방법이 겹 전환 자막과 좌하단 나침반뿐이었다. 앞은 전환이 끝나면 사라지고 뒤는
 * 구석에 있고 접히는 데다, 둘 다 축을 **문장이나 도식으로 설명할 뿐** 화면의 실제 방향과
 * 이어지지 않는다. 오른쪽 가장자리에 "밝고 거친" 이 적혀 있으면 오른쪽으로 끄는 일이 곧
 * 그쪽으로 가는 일이 된다.
 *
 * **평소엔 연하게, 움직이면 또렷하게.** 늘 진하면 곡 제목과 시야를 다투고, 전환할 때만
 * 뜨면 오 분 뒤에 "어느 쪽이 밝은 거였지" 하면 답이 없다. 밝기를 두 단계로 두면 둘 다 된다.
 * 13px 글씨·30% 투명도로는 평소에 아예 안 보여서(S15P21A405-719) 유리 화살표를 붙이고 글씨를 키웠다.
 *
 * **보이는 지도의 네 변 가운데에 대칭으로 선다** (S15P21A405-719). 가림 영역(윗줄·재생바·우측 패널)을 뺀
 * 사각형 기준이라, 패널이 열리면 위아래 화살표도 남은 지도 가운데로 옮겨 간다.
 *
 * 움직임은 **카메라를 들여다봐서** 안다. 휠·드래그 이벤트를 듣는 것보다 확실하다 — 내 위치로
 * 가기나 겹 전환처럼 코드가 옮기는 경우까지 같은 잣대로 잡힌다.
 */
export default function MapAxisLabels({ occlusion }: { occlusion: Occlusion }) {
  const layer = useMapStore((s) => s.layer);
  const [awake, setAwake] = useState(false);

  useEffect(() => {
    let last = "";
    let calmAt = 0;
    const id = window.setInterval(() => {
      const c = getMapEngine()?.cam;
      if (!c) return;
      const now = `${c.s.toFixed(4)}|${c.cx.toFixed(2)}|${c.cy.toFixed(2)}`;
      if (now !== last) {
        last = now;
        calmAt = Date.now() + CALM_MS;
        setAwake(true);
      } else if (calmAt && Date.now() > calmAt) {
        calmAt = 0;
        setAwake(false);
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const ax = LAYER_AXES[layer];
  // 라벨이 빈 축은 이름을 지어내지 않는다 — 나침반이 쓰는 말과 같게 적는다
  const x = ax.x[0] ? ax.x : (["미세한 차이", "미세한 차이"] as const);
  const y = ax.y[0] ? ax.y : (["미세한 차이", "미세한 차이"] as const);

  const { top, right, bottom, left } = occlusion;
  // 보이는 지도 사각형의 가로·세로 가운데
  const midX = `calc((100% + ${left - right}px) / 2)`;
  const midY = `calc((100% + ${top - bottom}px) / 2)`;

  const wrap = "pointer-events-none absolute z-[19] flex items-center";
  // 글씨도 유리와 같은 결로 한 단계 내렸다 — 평소엔 거의 잠기고, 움직이면 ink-3 까지만 올라온다 (사용자 피드백)
  const text = `max-w-[24vw] truncate text-[15px] font-medium tracking-[0.02em] transition-colors duration-500 ${awake ? "text-ink-3" : "text-ink-4/60"}`;
  return (
    <>
      <div className={`${wrap} -translate-y-1/2 gap-2`} style={{ left: left + EDGE_GAP, top: midY }}>
        <GlassArrow dir="left" awake={awake} />
        <span className={text}>{x[0]}</span>
      </div>
      {/* 우측 패널이 열리면 그만큼 안쪽으로 — 패널 뒤에 숨으면 적어 둔 보람이 없다 */}
      <div className={`${wrap} -translate-y-1/2 gap-2`} style={{ right: right + EDGE_GAP, top: midY }}>
        <span className={`${text} text-right`}>{x[1]}</span>
        <GlassArrow dir="right" awake={awake} />
      </div>
      {/* 위아래는 검색창·플레이어바 바로 안쪽까지만 — 그 밑에 깔리면 안 보인다 */}
      <div className={`${wrap} -translate-x-1/2 flex-col gap-1.5`} style={{ top: top + EDGE_GAP, left: midX }}>
        <GlassArrow dir="up" awake={awake} />
        <span className={`${text} text-center`}>{y[1]}</span>
      </div>
      <div className={`${wrap} -translate-x-1/2 flex-col-reverse gap-1.5`} style={{ bottom: bottom + EDGE_GAP, left: midX }}>
        <GlassArrow dir="down" awake={awake} />
        <span className={`${text} text-center`}>{y[0]}</span>
      </div>
    </>
  );
}
