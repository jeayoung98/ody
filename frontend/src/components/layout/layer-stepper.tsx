"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRightIcon } from "@/components/common/icons";
import { LAYER_COUNT, LAYER_NAMES } from "@/constants";
import { ro } from "@/lib/korean";
import { useFollowStore } from "@/stores/use-follow-store";
import { useMapStore } from "@/stores/use-map-store";

/**
 * #crumbs — **지나온 겹의 자취** (MAP-07, S15P21A405-477).
 *
 * `우주 L0 › 은하단 L1 › …` 처럼 **밟아 온 겹만** 적는다. 예전에는 여덟 겹을 항상 전부 네모
 * 칸으로 늘어놓았는데, 가 보지도 않은 겹이 자리를 차지해 "지금 어디까지 왔나" 가 안 읽혔다.
 * 파고들 때마다 한 칸씩 자란다.
 *
 * 밑줄은 **칸을 가로지르는 한 줄**이다. 칸마다 조각을 그리면 그라데이션이 칸마다 처음부터
 * 다시 시작해 색이 뚝뚝 끊긴다 — 그래서 줄은 칸 밖에 따로 깔고, 채워진 길이만 재서 늘인다.
 * 그 덕에 왼쪽 끝은 늘 청록이고 오른쪽 끝은 늘 보라다(`grad-bg`).
 *
 * 상위 겹에 마우스를 올리면 **밑줄이 거기까지만 차오른다.** "여기를 누르면 여기까지 돌아간다"
 * 를 누르기 전에 보여 주는 자리다. 누르면 중간 겹을 거치지 않고 한 번에 떠오른다(`surfaceTo`).
 *
 * 게이트가 열리면 **다음 겹 한 칸이 희미하게 미리 선다** — 내려가는 길도 여기서 이어진다.
 * 오버레이 뷰(주변 탐색·별자리)·따라가기·전환 중에는 전부 잠긴다 (PATH-01-1).
 */
export default function LayerStepper() {
  const layer = useMapStore((s) => s.layer);
  const gateOpen = useMapStore((s) => s.gateOpen);
  const canRise = useMapStore((s) => s.canRise);
  const morph = useMapStore((s) => s.morph);
  const drillDown = useMapStore((s) => s.drillDown);
  const surfaceTo = useMapStore((s) => s.surfaceTo);
  const overlayOpen = useMapStore((s) => s.viewMode !== "default");
  const isFollowing = useFollowStore((s) => s.leaderEmail != null);
  /** 마우스가 얹힌 겹. 밑줄이 여기까지만 찬다 */
  const [hover, setHover] = useState<number | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);

  const locked = isFollowing || morph || overlayOpen;
  /** 게이트가 열렸으면 다음 겹까지 그린다 — 내려가는 길을 자취 끝에 이어 붙인다 */
  const nextOpen = !locked && gateOpen && layer + 1 < LAYER_COUNT;
  const last = nextOpen ? layer + 1 : layer;
  /** 밑줄이 차오르는 끝. 상위 겹을 겨누고 있으면 거기까지 */
  const filled = hover ?? layer;

  /**
   * 채운 길이를 **재서 넣는다.** 칸 폭이 글자 수에 따라 달라 CSS 만으로는 "여기까지" 를
   * 말할 수 없다. 상태로 들고 있으면 렌더가 한 번 더 도는데 그럴 값이 아니라 DOM 에 직접 쓴다
   * — 늘어나고 줄어드는 움직임은 CSS transition 이 맡는다.
   */
  useEffect(() => {
    const rail = railRef.current;
    const fill = fillRef.current;
    if (!rail || !fill) return;
    const crumbs = rail.querySelectorAll<HTMLElement>("button");
    const end = crumbs[Math.min(filled, crumbs.length - 1)];
    fill.style.width = end ? `${end.offsetLeft + end.offsetWidth}px` : "0px";
  }, [filled, last, layer]);

  return (
    <div ref={railRef} // `w-fit` — 줄이 자취보다 길게 삐져나오면 "더 갈 데가 있다" 는 딴 소리가 된다
      className="pointer-events-auto relative flex w-fit max-w-[min(34vw,420px)] items-stretch pb-[3px]" onMouseLeave={() => setHover(null)}>
      {Array.from({ length: last + 1 }, (_, i) => {
        const on = i === layer;
        const next = i === layer + 1;
        // 위로는 어디든(되돌아갈 프레임이 있을 때), 아래로는 게이트가 열린 다음 한 칸만
        const enabled = !locked && (next ? gateOpen : i < layer && canRise);
        const aimed = hover != null && i <= hover;
        return (
          <button
            key={i}
            type="button"
            disabled={!enabled}
            onClick={() => (next ? drillDown() : surfaceTo(i))}
            onMouseEnter={() => enabled && !next && setHover(i)}
            title={
              on
                ? `지금 단계 · ${LAYER_NAMES[i]}`
                : overlayOpen
                  ? "뷰를 닫으면 다시 이동할 수 있어요"
                  : next
                    ? "한 칸 깊이 — 이 겹의 별을 그대로 데려가 새 축으로 재투영"
                    : `${LAYER_NAMES[i]}${ro(LAYER_NAMES[i])} 떠오르기 — 두고 온 별이 돌아오고 좌표도 복원`
            }
            className="group flex items-center gap-1 px-[5px] pt-1 pb-1.5 text-[11.5px] leading-none whitespace-nowrap disabled:cursor-default"
          >
            <span
              className={`transition-colors duration-fast ${
                on ? "font-semibold text-ink" : next ? "text-teal/70" : aimed ? "text-ink" : "text-ink-4 group-hover:text-ink-2"
              }`}
            >
              {LAYER_NAMES[i]}
              <em className="num ml-1 text-[8px] tracking-[0.02em] opacity-55 not-italic">L{i}</em>
            </span>
            {/* 꺾쇠는 칸 사이를 잇는 표시라 마지막 칸에는 없다 */}
            {i < last && <ChevronRightIcon size={13} className="-mr-1 shrink-0 text-ink-4" />}
          </button>
        );
      })}
      {/* 밑줄 — 칸 밖에 한 줄로 깔아야 그라데이션이 안 끊긴다 */}
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] rounded-pill bg-white/[.13]" />
      <span ref={fillRef} aria-hidden className="grad-bg absolute bottom-0 left-0 h-[3px] rounded-pill transition-[width] duration-normal ease-spring" />
    </div>
  );
}
