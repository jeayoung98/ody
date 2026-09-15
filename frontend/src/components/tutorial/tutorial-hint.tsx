"use client";

import { useEffect, useState } from "react";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { MouseWheelIcon } from "@/components/common/icons";

/**
 * 휠을 굴리라는 손짓 (S15P21A405-351). 덤은 다른 단계와 같은 한 겹을 쓰고
 * (`tutorial-spotlight.tsx`) 여기서는 그 위에 마우스만 올린다.
 */
export function WheelHint() {
  return (
    <div className="pointer-events-none fixed inset-0 grid place-items-center">
      <div className="flex flex-col items-center gap-2.5">
        <div className="relative">
          <MouseWheelIcon className="text-teal drop-shadow-[0_0_16px_#4fe3ce]" />
          {/* 마우스 안 점이 굴러 내려간다 — 그림만으로 "휠" 이 읽히게 */}
          <i className="animate-twheel absolute top-[26%] left-1/2 block h-[5px] w-[5px] -translate-x-1/2 rounded-pill bg-teal" />
        </div>
        <span className="lbl text-teal">휠을 굴려 확대</span>
      </div>
    </div>
  );
}

/**
 * 짚어 준 별 (S15P21A405-351). 캔버스에 그려진 점이 아니라 **오버레이 위에 직접 그린다.**
 *
 * 캔버스 별에 기대면 두 가지로 깨졌다. 화면에 보이는 별이 열 개 남짓일 때는 짚을 별이 아예
 * 안 나왔고, 나와도 재생수가 적은 곡은 점이 희미해 안 보였다. 여기서 그리면 어느 쪽도 없다.
 *
 * 자리는 **매 프레임 다시 묻는다** — 카메라가 조금이라도 움직이면 어제 잰 자리는 틀린 자리다.
 */
export function StarHint({ musicId, onPick }: { musicId: number; onPick: () => void }) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const c = document.querySelector("canvas")?.getBoundingClientRect();
      const p = getMapEngine()?.starPos(musicId);
      setAt((prev) => {
        const next = c && p ? { x: c.left + p.x, y: c.top + p.y } : null;
        return prev?.x === next?.x && prev?.y === next?.y ? prev : next;
      });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [musicId]);

  if (!at) return null;
  return (
    <button
      type="button"
      aria-label="이 별 누르기"
      onClick={onPick}
      className="pointer-events-auto fixed grid h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center"
      style={{ left: at.x, top: at.y }}
    >
      <i className="absolute inset-0 block rounded-pill bg-[radial-gradient(circle,rgba(79,227,206,.45)_0%,transparent_65%)]" />
      <i className="animate-tbeat absolute inset-[18px] block rounded-pill border-2 border-teal" />
      <i className="animate-tstar block h-3.5 w-3.5 rounded-pill bg-white shadow-[0_0_18px_6px_rgba(79,227,206,.9)]" />
    </button>
  );
}
