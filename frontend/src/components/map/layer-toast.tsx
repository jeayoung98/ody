"use client";

import { useMapStore } from "@/stores/use-map-store";

/**
 * 모프(파고들기/떠오르기) 진행 중 화면 중앙 안내 (#ov).
 *
 * **겹 이름과 그 아래 한 줄뿐이다** (S15P21A405-479). 예전에는 "색(장르)과 내 곡의 자리는
 * 그대로 — 주변만 다시 자리를 잡는다" 를 늘 세 번째 줄에 붙였는데, 전환은 1초도 안 되는
 * 연출이라 읽을 틈이 없으면서 자리는 계속 차지했다. 파고들 때마다 같은 문장이 반복돼
 * 몇 번 지나면 눈에 들어오지도 않는다.
 */
export default function LayerToast() {
  const morph = useMapStore((s) => s.morph);
  return (
    <div
      className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-center transition-opacity duration-[250ms] ${morph ? "opacity-100" : "opacity-0"}`}
    >
      <div className="grad-text font-display text-[clamp(20px,3vw,30px)] font-semibold text-balance [text-shadow:0_2px_24px_#000]">{morph?.big}</div>
      <div className="text-sm text-ink opacity-85 [text-shadow:0_2px_16px_#000]">{morph?.sub}</div>
    </div>
  );
}
