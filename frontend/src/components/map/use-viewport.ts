"use client";

import { useEffect, useRef, useState } from "react";

/** 컨테이너 div 크기를 추적. canvas 가 아니라 부모 div 를 관찰해 되먹임 루프를 피한다 */
export function useViewport() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth || 1, height: el.clientHeight || 1 });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, size };
}
