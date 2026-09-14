"use client";

import { useEffect, useState } from "react";

/** 곡 길이를 모를 때만 쓰는 예전 데모 길이. 그때는 예전처럼 되풀이한다 */
const DEMO_LENGTH_MS = 30_000;

const TICK_MS = 500;

interface PlayerProgressProps {
  active: boolean;
  musicId: number | null;
  /** 곡 길이(초). 백엔드가 주면 진짜 길이로 돈다 */
  durationSec?: number | null;
}

/**
 * #tBar — 재생 진행 바.
 *
 * 곡 길이를 알면 **그 길이로 한 번** 채우고 멈춘다. 자동 넘김(S15P21A405-258)이 같은 값으로
 * 다음 곡으로 넘기므로 화면과 동작이 같은 시계를 본다.
 *
 * 길이를 모르는 곡은 예전처럼 30초 데모로 되풀이한다 — 멈춰 있는 바보다는 낫다.
 *
 * ⚠️ 어느 쪽이든 **실제 재생과 이어져 있지 않다.** 음원은 앱 밖에서 도는데 그쪽에서 멈추거나
 * 되감아도 여기는 모른다. `videoId` 가 들어와 임베드가 붙으면 진짜 재생 위치로 바꾼다.
 */
export default function PlayerProgress({ active, musicId, durationSec }: PlayerProgressProps) {
  const lengthMs = durationSec != null && durationSec > 0 ? durationSec * 1000 : null;
  const [state, setState] = useState({ musicId, t: 0 });

  // 곡이 바뀌면 렌더 중에 진행도를 0으로 맞춘다 (effect 안 setState 대신 "adjusting state during render")
  if (state.musicId !== musicId) setState({ musicId, t: 0 });

  useEffect(() => {
    if (!active) return;
    const id = setInterval(
      () =>
        setState((s) => {
          const t = s.t + TICK_MS;
          // 길이를 아는 곡은 끝에서 멈춘다. 모르는 곡만 되풀이한다
          return { ...s, t: lengthMs == null ? t % DEMO_LENGTH_MS : Math.min(t, lengthMs) };
        }),
      TICK_MS,
    );
    return () => clearInterval(id);
  }, [active, lengthMs]);

  const ratio = Math.min(1, state.t / (lengthMs ?? DEMO_LENGTH_MS));

  return (
    <span className="mt-[5px] block h-[3px] overflow-hidden rounded-pill bg-white/10">
      <i
        className="grad-bg block h-full rounded-pill transition-[width] duration-[180ms] ease-linear"
        style={{ width: `${ratio * 100}%` }}
      />
    </span>
  );
}
