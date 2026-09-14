"use client";

import { useToastStore } from "@/stores/use-toast-store";

/**
 * 하단 안내 토스트. 플레이어바 **위**에 떠서 조작을 가리지 않는다.
 * 지도 위 요소이므로 클릭을 먹지 않는다 (pointer-events 없음).
 */
export default function Toast() {
  const message = useToastStore((s) => s.message);
  const seq = useToastStore((s) => s.seq);
  return (
    <div className="pointer-events-none absolute bottom-[86px] left-1/2 z-[30] -translate-x-1/2">
      {message && (
        <div key={seq} className="glass animate-tin rounded-pill! px-3.5 py-2 text-[12px] text-ink shadow-[0_8px_28px_-10px_#000]">
          {message}
        </div>
      )}
    </div>
  );
}
