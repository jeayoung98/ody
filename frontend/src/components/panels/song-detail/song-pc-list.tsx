"use client";

import { useMemo, useState } from "react";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { ChevronDownIcon } from "@/components/common/icons";
import ProgressBar from "@/components/common/progress-bar";
import SectionTitle from "@/components/common/section-title";
import { pcAxisPair } from "@/constants";
import SongPcChart, { type PcRow } from "./song-pc-chart";

interface SongPcListProps {
  /** 주성분 16개(원값). 이름도 정규화도 여기서 한다 */
  items: { axis: number; value: number }[];
}

/** 차트로 세울 개수. 이 곡을 가장 잘 설명하는 축 다섯 */
const TOP = 5;
/** 바를 꽉 채우는 치우침. 이보다 더 치우친 곡은 드물다 */
const FULL_SD = 3;

/**
 * .feat — 고정 주성분. **이 곡이 어느 쪽으로 치우쳤는지**를 축 이름으로 읽히게 한다
 * (S15P21A405-355).
 *
 * 예전에는 `PC1` … 처럼 번호만 달고 앞에서부터 여섯 개를 잘랐다. 숫자만으로는 그 값이 무슨
 * 소리를 뜻하는지 알 수 없고, 앞 여섯 개가 꼭 그 곡을 설명하는 축도 아니다 — 0 근처에 있는
 * 축은 아무 말도 안 해 준다. 지도가 겹마다 쓰는 축 이름을 그대로 가져와(`pcAxisPair`)
 * 사용자가 보는 말과 지도를 맞추고, **치우친 순서**로 세운다.
 *
 * 치우침은 원값 크기가 아니라 **축별 표준편차로 나눈 값**으로 잰다. 축마다 흩어진 폭이
 * 달라서(PC1 은 ±20 대, PC8 은 ±1 대) 원값끼리 견주면 폭이 큰 축이 늘 이긴다. 잣대는
 * 지도가 들고 있는 이 겹 상주 집합이다 (`pcStats`).
 *
 * **위 다섯은 차트, 나머지는 목록이다** (S15P21A405-384). 이 곡을 설명하는 축 다섯은 서로
 * 견줘 봐야 하므로 0 을 가운데 둔 막대 그림으로 세우고(`song-pc-chart`, chart.js), 그 아래
 * 덜 치우친 축들은 굳이 그림이 필요 없어 한 줄짜리 진행바 목록으로 접어 둔다.
 */
export default function SongPcList({ items }: SongPcListProps) {
  const [open, setOpen] = useState(false);
  const stats = getMapEngine()?.pcStats();

  /**
   * **붙잡아 둔다.** 차트는 배열이 바뀌면 다시 짓고 애니메이션을 처음부터 돌린다 — 렌더마다
   * 새 배열을 주면 접었다 펴기만 해도 막대가 다시 자란다. `items` 는 쿼리 응답이라 곡이
   * 바뀔 때만, `stats` 는 엔진이 겹마다 캐시하므로 겹이 바뀔 때만 갈린다.
   */
  const rows = useMemo<PcRow[]>(
    () =>
      items
        .map((p) => {
          // 뜻이 없는 축(PC4 · PC12)은 쌍이 없다 — 없는 의미를 지어 붙이면 그쪽으로 곡을 찾다가 헛수고한다
          const pair = pcAxisPair(p.axis);
          return pair && {
            axis: p.axis,
            left: pair[0],
            right: pair[1],
            // 잣대가 아직 없으면(지도가 안 떴을 때) 원값 순서로라도 세운다
            sd: stats ? (p.value - stats.mean[p.axis]) / stats.sd[p.axis] : p.value,
          };
        })
        .filter((p): p is PcRow => p != null)
        .sort((a, b) => Math.abs(b.sd) - Math.abs(a.sd)),
    [items, stats],
  );
  const top = useMemo(() => rows.slice(0, TOP), [rows]);
  const rest = useMemo(() => rows.slice(TOP), [rows]);

  if (!rows.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <SectionTitle tone="sentence" aside={`치우친 순 ${open ? rows.length : top.length}/${rows.length}`}>
        이 곡을 설명하는 축
      </SectionTitle>
      <SongPcChart rows={top} />
      {rest.length > 0 && (
        <>
          <div className={`grid transition-[grid-template-rows] duration-normal ease-spring ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
            {/* 0fr 일 때 안쪽이 삐져나오지 않게 — 자라는 동안 잘리는 쪽이 이 칸이다 */}
            <div className="overflow-hidden">
              <div className="flex flex-col gap-[7px] pt-0.5">
                {rest.map((pc) => (
                  <ProgressBar
                    key={pc.axis}
                    // 차트와 같은 기준으로 쪽을 고른다 — 막대가 가리키는 쪽의 말
                    label={pc.sd >= 0 ? pc.right : pc.left}
                    code={`PC${pc.axis + 1}`}
                    percent={((Math.max(-FULL_SD, Math.min(FULL_SD, pc.sd)) / FULL_SD + 1) / 2) * 100}
                    valueText={`${pc.sd > 0 ? "+" : ""}${pc.sd.toFixed(1)}σ`}
                  />
                ))}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "고정 주성분 접기" : "고정 주성분 더보기"}
            className="grid h-7 w-full place-items-center rounded-box-xs text-ink-3 transition-colors duration-fast hover:bg-white/[.05] hover:text-ink"
          >
            <ChevronDownIcon className={`transition-transform duration-normal ease-spring ${open ? "rotate-180" : ""}`} />
          </button>
        </>
      )}
    </div>
  );
}
