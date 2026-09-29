"use client";

import { LAYER_AXES } from "@/constants";
import { useMapStore } from "@/stores/use-map-store";

/**
 * 나침반 별 한 갈래 — 위(북)를 가리키는 원본이고, 나머지 방향은 돌려 쓴다.
 * 왼쪽 절반을 밝게, 오른쪽 절반을 어둡게 채워 종이 나침반의 입체감을 낸다.
 */
function Point({ len, wide, rotate, bright, dim }: { len: number; wide: number; rotate: number; bright: number; dim: number }) {
  const tip = 60 - len;
  const base = 60 - wide * 1.6;
  return (
    <g transform={`rotate(${rotate} 60 60)`}>
      <polygon points={`60,${tip} ${60 - wide},${base} 60,60`} fill="#ffffff" fillOpacity={bright} />
      <polygon points={`60,${tip} ${60 + wide},${base} 60,60`} fill="#ffffff" fillOpacity={dim} />
      <polygon points={`60,${tip} ${60 - wide},${base} 60,60 ${60 + wide},${base}`} fill="none" stroke="#ffffff" strokeOpacity={0.35} strokeWidth={0.8} strokeLinejoin="round" />
    </g>
  );
}

/**
 * #compass — 현재 레이어의 두 축 (MAP-06). 라벨의 기준 문서는 [docs/rules/PC-AXES.md](../../../../docs/rules/PC-AXES.md) 다.
 *
 * **8개 별 나침반** (S15P21A405-722, 사용자 결정). 예전에는 테두리 상자 안에 십자선과 ▲▼◀▶ 라벨이었다.
 * 상자·원·눈금은 없고 가운데 별과 네 축 라벨만 **흰색으로 은은하게** 늘 떠 있다 — 계기판 안에서
 * 방향만 조용히 알려 주는 것이라 밝으면 눈을 끈다. 긴 갈래 넷이 축 방향, 짧은 갈래 넷은 장식이다.
 *
 * 라벨은 `LAYER_AXES` 그대로다 — 위가 세로축 높은 값, 아래가 낮은 값, 오른쪽이 가로축 높은 값, 왼쪽이 낮은 값.
 * 뜻이 없는 축(빈 문자열)은 "미세한 차이" 로 적는다 (지금은 없다).
 */
export default function AxisCompass() {
  const layer = useMapStore((s) => s.layer);
  const ax = LAYER_AXES[layer];
  const t = (s: string) => s || "미세한 차이";
  const cl = "absolute text-[11.5px] leading-[1.3] text-ink-2";
  return (
    <div className="relative mt-px h-[124px]">
      <svg viewBox="0 0 120 120" className="absolute top-1/2 left-1/2 h-[92px] w-[92px] -translate-x-1/2 -translate-y-1/2" aria-hidden>
        {/* 짧은 갈래(대각) 먼저 — 긴 갈래가 위에 덮인다 */}
        {[45, 135, 225, 315].map((r) => (
          <Point key={r} len={27} wide={4} rotate={r} bright={0.3} dim={0.1} />
        ))}
        {[0, 90, 180, 270].map((r) => (
          <Point key={r} len={46} wide={5.5} rotate={r} bright={0.55} dim={0.18} />
        ))}
        <circle cx="60" cy="60" r="1.6" fill="#ffffff" fillOpacity={0.7} />
      </svg>
      <span className={`${cl} top-0 left-1/2 max-w-[70%] -translate-x-1/2 text-center`}>{t(ax.y[1])}</span>
      <span className={`${cl} bottom-0 left-1/2 max-w-[70%] -translate-x-1/2 text-center`}>{t(ax.y[0])}</span>
      <span className={`${cl} top-1/2 left-0 max-w-[30%] -translate-y-1/2 text-left`}>{t(ax.x[0])}</span>
      <span className={`${cl} top-1/2 right-0 max-w-[30%] -translate-y-1/2 text-right`}>{t(ax.x[1])}</span>
    </div>
  );
}
