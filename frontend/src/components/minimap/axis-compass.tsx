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
      <polygon points={`60,${tip} ${60 - wide},${base} 60,60 ${60 + wide},${base}`} fill="none" stroke="#ffffff" strokeOpacity={0.13} strokeWidth={0.8} strokeLinejoin="round" />
    </g>
  );
}

/**
 * #compass — 현재 레이어의 두 축 (MAP-06). 라벨의 기준 문서는 [docs/rules/PC-AXES.md](../../../../docs/rules/PC-AXES.md) 다.
 *
 * **8개 별 나침반, 미니맵 위에 겹친다** (S15P21A405-722, 사용자 결정). 예전에는 따로 선 테두리 상자 안에
 * 십자선과 ▲▼◀▶ 라벨이었다. 지금은 미니맵을 덮는 오버레이다 — 가운데 별과 네 축 라벨만 **흰색으로
 * 아주 연하게** 늘 떠 있어, 지도 축소판 안에서 어느 쪽이 무슨 뜻인지 바로 읽힌다. 별은 뒤의 점들을
 * 가리면 안 되어 채움이 더 옅다. 긴 갈래 넷이 축 방향, 짧은 갈래 넷은 장식이다.
 * 클릭은 받지 않는다 — 미니맵을 눌러 이동하는 동작이 그대로 살아야 한다.
 *
 * 라벨은 `LAYER_AXES` 그대로다 — 위가 세로축 높은 값, 아래가 낮은 값, 오른쪽이 가로축 높은 값, 왼쪽이 낮은 값.
 * 뜻이 없는 축(빈 문자열)은 "미세한 차이" 로 적는다 (지금은 없다).
 */
export default function AxisCompass() {
  const layer = useMapStore((s) => s.layer);
  const ax = LAYER_AXES[layer];
  const t = (s: string) => s || "미세한 차이";
  // 미니맵 점 위에 얹히는 글자라 그림자로 바탕을 눌러 준다
  const cl = "absolute text-[10.5px] leading-[1.25] text-ink-2 drop-shadow-[0_1px_3px_rgba(2,4,10,.95)]";
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {/* 미니맵 높이(150) 안에서 라벨 줄을 비켜 서는 크기 */}
      <svg viewBox="0 0 120 120" className="absolute top-1/2 left-1/2 h-[124px] w-[124px] -translate-x-1/2 -translate-y-1/2">
        {/* 짧은 갈래(대각) 먼저 — 긴 갈래가 위에 덮인다 */}
        {[45, 135, 225, 315].map((r) => (
          <Point key={r} len={27} wide={4} rotate={r} bright={0.07} dim={0.025} />
        ))}
        {[0, 90, 180, 270].map((r) => (
          <Point key={r} len={52} wide={5.5} rotate={r} bright={0.14} dim={0.045} />
        ))}
        <circle cx="60" cy="60" r="1.6" fill="#ffffff" fillOpacity={0.25} />
      </svg>
      <span className={`${cl} top-1.5 left-1/2 max-w-[70%] -translate-x-1/2 text-center`}>{t(ax.y[1])}</span>
      <span className={`${cl} bottom-1.5 left-1/2 max-w-[70%] -translate-x-1/2 text-center`}>{t(ax.y[0])}</span>
      <span className={`${cl} top-1/2 left-2 max-w-[32%] -translate-y-1/2 text-left`}>{t(ax.x[0])}</span>
      <span className={`${cl} top-1/2 right-2 max-w-[32%] -translate-y-1/2 text-right`}>{t(ax.x[1])}</span>
    </div>
  );
}
