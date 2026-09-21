"use client";

import { useState } from "react";
import { ChevronRightIcon } from "@/components/common/icons";
import { LAYER_COUNT, LAYER_NAMES } from "@/constants";
import { ro } from "@/lib/korean";
import { useFollowStore } from "@/stores/use-follow-store";
import { useMapStore } from "@/stores/use-map-store";

/**
 * #crumbs — **지나온 겹의 자취** (MAP-07, S15P21A405-477).
 *
 * `우주 › 은하단 › 우리은하` 처럼 **밟아 온 겹만** 적는다. 예전에는 여덟 겹을 항상 전부 네모
 * 칸으로 늘어놓았는데, 가 보지도 않은 겹이 자리를 차지해 "지금 어디까지 왔나" 가 안 읽혔다.
 * 파고들 때마다 한 칸씩 자란다.
 *
 * **글자와 꺾쇠뿐이다.** 테두리도 밑줄도 `L0` 같은 번호도 없다 — 웹에서 흔한 빵부스러기
 * 그대로다. 지금 겹만 굵고 밝게, 지나온 겹은 흐리게 두면 위치는 그것만으로 읽힌다.
 * 번호는 이름 옆에 붙어 있어 봐야 "몇 번째 겹" 과 "몇 겹짜리 지도" 가 헷갈리기만 했다.
 *
 * 상위 겹에 마우스를 올리면 **거기까지가 밝아지고 그 뒤는 더 흐려진다.** "여기를 누르면
 * 여기까지 돌아간다" 를 누르기 전에 보여 주는 자리다. 누르면 중간 겹을 거치지 않고 한 번에
 * 떠오른다(`surfaceTo`).
 *
 * 게이트가 열리면 **다음 겹 한 칸이 청록으로 미리 선다** — 내려가는 길도 여기서 이어진다.
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
  /** 마우스가 얹힌 겹. 여기까지가 "돌아갈 길" 이다 */
  const [hover, setHover] = useState<number | null>(null);

  const locked = isFollowing || morph || overlayOpen;
  /** 게이트가 열렸으면 다음 겹까지 그린다 — 내려가는 길을 자취 끝에 이어 붙인다 */
  const nextOpen = !locked && gateOpen && layer + 1 < LAYER_COUNT;
  const last = nextOpen ? layer + 1 : layer;

  /**
   * 이 칸의 글자 크기. **지나온 겹은 작다** (S15P21A405-479). 색과 굵기만으로 갈라 두었더니
   * 여덟 칸이 다 같은 덩치라 "지금 어디" 가 한눈에 안 잡혔다. 크기까지 다르면 훑기만 해도 읽힌다.
   *
   * 다음 겹(청록 미리보기)은 줄이지 않는다 — 지나온 길이 아니라 **갈 수 있는 길**이라, 작아지면
   * 이미 지난 것처럼 보인다. 줄에서 가장 큰 글자가 늘 지금 겹이라 `items-center` 기준선도
   * 흔들리지 않는다.
   */
  const size = (i: number) => (i < layer ? "text-sm" : "text-lg");

  /** 이 칸의 글자 색. 겨누는 중이면 돌아갈 길만 밝고 나머지는 물러난다 */
  const tone = (i: number) => {
    if (i === layer + 1) return "text-teal/70";
    if (hover != null) return i <= hover ? "text-ink" : "text-ink-4/70";
    return i === layer ? "font-semibold text-ink" : "text-ink-3";
  };

  return (
    <div className="pointer-events-auto flex w-fit max-w-[min(34vw,420px)] items-center" onMouseLeave={() => setHover(null)}>
      {Array.from({ length: last + 1 }, (_, i) => {
        const on = i === layer;
        const next = i === layer + 1;
        // 위로는 어디든(되돌아갈 프레임이 있을 때), 아래로는 게이트가 열린 다음 한 칸만
        const enabled = !locked && (next ? gateOpen : i < layer && canRise);
        return (
          <div key={i} className="flex items-center">
            {i > 0 && <ChevronRightIcon size={16} className="shrink-0 text-ink-4/60" />}
            <button
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
              className={`px-2 py-1 leading-none whitespace-nowrap transition-colors duration-fast disabled:cursor-default ${size(i)} ${tone(i)}`}
            >
              {LAYER_NAMES[i]}
            </button>
          </div>
        );
      })}
    </div>
  );
}
