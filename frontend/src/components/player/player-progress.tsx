"use client";

import { useEffect, useState } from "react";

const DEMO_LENGTH_MS = 30_000;

/** #tBar — 재생 진행 바. 실제 플레이어 연동 전까지는 30초 데모 진행 */
export default function PlayerProgress({ active, musicId }: { active: boolean; musicId: number | null }) {
  const [state, setState] = useState({ musicId, t: 0 });

  // 곡이 바뀌면 렌더 중에 진행도를 0으로 맞춘다 (effect 안 setState 대신 "adjusting state during render")
  if (state.musicId !== musicId) setState({ musicId, t: 0 });

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setState((s) => ({ ...s, t: (s.t + 500) % DEMO_LENGTH_MS })), 500);
    return () => clearInterval(id);
  }, [active]);

  return (
    <span className="mt-[5px] block h-[3px] overflow-hidden rounded-pill bg-white/10">
      <i className="grad-bg block h-full rounded-pill transition-[width] duration-[180ms] ease-linear" style={{ width: `${(state.t / DEMO_LENGTH_MS) * 100}%` }} />
    </span>
  );
}
