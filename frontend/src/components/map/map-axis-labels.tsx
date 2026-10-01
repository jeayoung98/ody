"use client";

import { DEMO } from "@/constants/demo";
import type { CSSProperties } from "react";
import type { Occlusion } from "@/components/map/engine/map-engine";
import { LAYER_AXES } from "@/constants";
import { useMapStore } from "@/stores/use-map-store";

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
/**
 * 화면에 그릴 배율 — 원본 200px 을 150px 로. 0.56 은 얇은 날개라 유리가 안 읽혔고, 0.8 은 너무 컸다(사용자 피드백, 719).
 * 0.64 로 두었다가 "잘 안 보인다" 로 한 단계 키웠다 (S15P21A405-729). ponytail: 더/덜은 이 값만
 */
const SCALE = 0.75;
const W = BASE_W * SCALE;
const H = BASE_H * SCALE;
/** 화살표 끝이 가림 영역(검색창·재생바·패널)에서 떨어지는 거리 */
const EDGE_GAP = 10;
/**
 * 위아래 화살표가 화면 위·아래 끝에서 떨어지는 거리 (S15P21A405-719).
 * 가림 영역(`HUD_OCCLUSION` 58·92)을 쓰면 위는 검색창에 8px 로 붙고 아래는 붕 떴다(사용자 피드백).
 * 데스크톱 재생바는 우측 패널 칸(오른쪽 아래)에 있어 **아래 가운데는 비어 있는데** 92 는 재생바 몫이라서다.
 * - 위: 검색창 아래끝 60(`hud-t` 16 + `h-11` 44) + 16 간격
 * - 아래: 가릴 것이 없어 끝으로 붙인다. 검색창–위 화살표 간격(16)보다 조금 더 띄운다(사용자 결정)
 */
const EDGE_TOP = 76;
const EDGE_BOTTOM = 24;

/** `clip-path: path()` 는 px 좌표만 받고 배율을 따로 못 준다 — 숫자를 미리 곱해 둔다 */
const scalePath = (d: string) => d.replace(/-?\d+(\.\d+)?/g, (n) => String(+(Number(n) * SCALE).toFixed(2)));
const CLIP = `path('${scalePath(WING)} ${scalePath(DIAMOND)}')`;

/**
 * 유리 세기 — **한 단계만 둔다** (S15P21A405-729). 예전에는 카메라가 멎으면 연해지는 calm 단계가 따로 있었는데
 * 시연 화면에서 "라벨이 잘 안 보인다" 로 겪었다. 옛 awake 값을 조금 더 올린 값이다. 투명도(opacity)로 흐리게
 * 하지 않는 원칙은 그대로 — 흐리게 하면 유리가 아니라 흐린 그림이 된다.
 */
const GLASS = { filter: "blur(8px) saturate(1.15) brightness(1.35)", tint: "rgb(255 255 255 / 0.1)", rim: 0.2 } as const;
// 시연용 (S15P21A405-732): 발표 화면에서 안 보여 밝힌 값
const DEMO_GLASS = { filter: "blur(10px) saturate(1.15) brightness(1.8)", tint: "rgb(255 255 255 / 0.24)", rim: 0.45 } as const;
const G = DEMO ? DEMO_GLASS : GLASS;

type Dir = "up" | "down" | "left" | "right";
/** 원본은 아래를 가리킨다 */
const ROTATE: Record<Dir, number> = { down: 0, up: 180, left: 90, right: -90 };

function GlassArrow({ dir }: { dir: Dir }) {
  const vertical = dir === "left" || dir === "right";
  const glass: CSSProperties = {
    width: W,
    height: H,
    clipPath: CLIP,
    background: G.tint,
    WebkitBackdropFilter: G.filter,
    backdropFilter: G.filter,
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
            strokeOpacity={G.rim}
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
 * **늘 또렷하다** (S15P21A405-729). 처음엔 "평소엔 연하게, 움직이면 또렷하게" 두 단계였다(358·719) —
 * 곡 제목과 시야를 다투지 않으려는 뜻이었는데, 시연 화면에서 연한 단계가 사실상 안 보였다. 카메라를
 * 들여다보던 타이머와 calm 단계를 걷어내고 한 세기로 고정했다. 글씨도 15px → 19px 로 키우고 그림자를 달아
 * 밝은 별·성운 위에서도 읽힌다.
 *
 * **네 변 가운데에 대칭으로 선다** (S15P21A405-719). 가로는 우측 패널을 뺀 보이는 지도 기준이라 패널이 열리면
 * 위아래 화살표도 남은 지도 가운데로 옮겨 간다. 세로는 화면 기준이다 — 위는 검색창 아래, 아래는 화면 끝 가까이(`EDGE_TOP`·`EDGE_BOTTOM`).
 *
 * 움직임은 **카메라를 들여다봐서** 안다. 휠·드래그 이벤트를 듣는 것보다 확실하다 — 내 위치로
 * 가기나 겹 전환처럼 코드가 옮기는 경우까지 같은 잣대로 잡힌다.
 */
export default function MapAxisLabels({ occlusion }: { occlusion: Occlusion }) {
  const layer = useMapStore((s) => s.layer);
  /**
   * 주변 탐색·별자리 뷰는 캔버스에 어두운 막을 그린다 (S15P21A405-725). 라벨은 DOM 이라 그 위에 그대로 떠서
   * 뷰가 켜졌는데 축 라벨만 밝게 남았다 — 막 뒤에 잠긴 것처럼 막의 세기(`CONSTELLATION.dim`)만큼 옅게 한다.
   * 투명도를 걸면 화살표의 유리(backdrop-filter)는 못 비치지만, 그 세기에서는 어차피 안 읽힌다.
   */
  const veiled = useMapStore((s) => s.viewMode !== "default");

  const ax = LAYER_AXES[layer];
  // 라벨이 빈 축은 이름을 지어내지 않는다 — 나침반이 쓰는 말과 같게 적는다
  const x = ax.x[0] ? ax.x : (["미세한 차이", "미세한 차이"] as const);
  const y = ax.y[0] ? ax.y : (["미세한 차이", "미세한 차이"] as const);

  const { right, left } = occlusion;
  // 보이는 지도(우측 패널 뺀) 가로 가운데
  const midX = `calc((100% + ${left - right}px) / 2)`;

  const wrap = `pointer-events-none absolute z-[19] flex items-center transition-opacity duration-500 ${veiled ? "opacity-[0.14]" : ""}`;
  // 글씨는 늘 진하다(ink-2). 별밭 위에서 획이 묻히지 않게 어두운 그림자를 깐다 (S15P21A405-729)
  const text = `max-w-[24vw] truncate text-[19px] font-semibold tracking-[0.02em] ${DEMO ? "text-ink" : "text-ink-2"} [text-shadow:0_1px_10px_rgb(0_0_0/0.85)]`;
  return (
    <>
      <div className={`${wrap} -translate-y-1/2 gap-2`} style={{ left: left + EDGE_GAP, top: "50%" }}>
        <GlassArrow dir="left" />
        <span className={text}>{x[0]}</span>
      </div>
      {/* 우측 패널이 열리면 그만큼 안쪽으로 — 패널 뒤에 숨으면 적어 둔 보람이 없다 */}
      <div className={`${wrap} -translate-y-1/2 gap-2`} style={{ right: right + EDGE_GAP, top: "50%" }}>
        <span className={`${text} text-right`}>{x[1]}</span>
        <GlassArrow dir="right" />
      </div>
      {/* 위는 검색창 바로 아래, 아래는 가릴 것이 없어 화면 끝 가까이 */}
      <div className={`${wrap} -translate-x-1/2 flex-col gap-1.5`} style={{ top: EDGE_TOP, left: midX }}>
        <GlassArrow dir="up" />
        <span className={`${text} text-center`}>{y[1]}</span>
      </div>
      <div className={`${wrap} -translate-x-1/2 flex-col-reverse gap-1.5`} style={{ bottom: EDGE_BOTTOM, left: midX }}>
        <GlassArrow dir="down" />
        <span className={`${text} text-center`}>{y[0]}</span>
      </div>
    </>
  );
}
