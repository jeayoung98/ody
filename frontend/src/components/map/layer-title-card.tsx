"use client";

import { useEffect, useRef, useState } from "react";
import { LAYER_NAMES, LAYER_NAMES_EN, LAYER_SUMMARIES, LAYER_TITLE } from "@/constants";
import { useMapStore } from "@/stores/use-map-store";

/**
 * 겹에 도착하면 화면 가운데에 겹 이름을 크게 띄웠다 거둔다 (S15P21A405-690).
 *
 * 전환 중에는 `LayerToast` 가 "○○으로 파고드는 중" 을 보이다 도착하는 순간 사라진다 — 그 자리를 이어받는다.
 * **처음 화면에는 띄우지 않는다.** 옮긴 적이 없는데 뜨면 무엇이 바뀌었는지 모른다.
 * 클릭은 막지 않는다(`pointer-events-none`). 같은 겹을 다시 밟아도 새로 띄운다(`key`).
 */
export default function LayerTitleCard() {
  const layer = useMapStore((s) => s.layer);
  const morph = useMapStore((s) => s.morph);
  const [shown, setShown] = useState<{ layer: number; seq: number } | null>(null);
  const prev = useRef(layer);

  useEffect(() => {
    if (prev.current === layer) return;
    prev.current = layer;
    setShown((s) => ({ layer, seq: (s?.seq ?? 0) + 1 }));
    const id = window.setTimeout(() => setShown(null), LAYER_TITLE.showMs);
    return () => window.clearTimeout(id);
  }, [layer]);

  // 전환이 아직 진행 중이면 기다린다 — 전환 한 줄과 겹쳐 두 글이 한 자리에 뜨지 않게
  if (!shown || morph) return null;
  return (
    <div key={shown.seq} className="animate-layer-title pointer-events-none absolute inset-0 z-[5] flex flex-col items-center justify-center gap-1.5 text-center">
      <span className="lbl tracking-[0.32em] text-ink-3">{LAYER_NAMES_EN[shown.layer]}</span>
      <span className="grad-text font-display text-[clamp(30px,5vw,52px)] leading-tight font-semibold [text-shadow:0_2px_28px_#000]">{LAYER_NAMES[shown.layer]}</span>
      <span className="max-w-[min(420px,86vw)] text-sm text-balance text-ink-2 [text-shadow:0_1px_12px_#000]">{LAYER_SUMMARIES[shown.layer]}</span>
    </div>
  );
}
