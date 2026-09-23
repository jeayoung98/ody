"use client";

import { useEffect, useRef } from "react";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { emojiOf } from "@/constants";
import type { FloatingReaction } from "@/stores/use-reaction-store";

/**
 * 반응 이모지 하나 (SOCIAL-02).
 * 바깥 div 는 지도 위 좌표를 따라다니는 앵커 — 매 프레임 엔진에서 보낸 사람의 화면 좌표를 받아 옮긴다.
 * 안쪽 span 이 떠올랐다 사라지는 연출을 맡는다. 보낸 사람이 화면 밖이면 통째로 숨긴다.
 */
export default function FloatingReactionItem({ reaction }: { reaction: FloatingReaction }) {
  const ref = useRef<HTMLDivElement>(null);
  const emoji = emojiOf(reaction.reactionKey);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = ref.current;
      if (el) {
        const engine = getMapEngine();
        const p = reaction.mine ? engine?.mePos() : reaction.fromEmail ? engine?.friendScreenPos(reaction.fromEmail) : null;
        if (p) {
          el.style.opacity = "1";
          el.style.transform = `translate(${p.x}px, ${p.y - 18}px)`;
        } else {
          el.style.opacity = "0";
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reaction.mine, reaction.fromEmail]);

  return (
    <div ref={ref} className="absolute top-0 left-0 opacity-0">
      <span className="animate-fly absolute bottom-0 left-0 flex flex-col items-center gap-0.5">
        <span className="text-[30px] leading-none drop-shadow-[0_2px_10px_rgba(0,0,0,.6)]">{emoji}</span>
        {reaction.nickname && <span className="lbl whitespace-nowrap text-[9px] text-ink-2">{reaction.nickname}</span>}
      </span>
    </div>
  );
}
