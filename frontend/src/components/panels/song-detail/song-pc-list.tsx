"use client";

import { useState } from "react";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import ProgressBar from "@/components/common/progress-bar";
import SectionTitle from "@/components/common/section-title";
import { pcAxisLabel } from "@/constants";

interface SongPcListProps {
  /** 주성분 16개(원값). 이름도 정규화도 여기서 한다 */
  items: { axis: number; value: number }[];
}

/** 접기 전에 보여 줄 개수. 이 곡을 가장 잘 설명하는 축 셋 */
const TOP = 3;
/** 바를 꽉 채우는 치우침. 이보다 더 치우친 곡은 드물다 */
const FULL_SD = 3;

/**
 * .feat — 고정 주성분. **이 곡이 어느 쪽으로 치우쳤는지**를 축 이름으로 읽히게 한다
 * (S15P21A405-355).
 *
 * 예전에는 `PC1` … 처럼 번호만 달고 앞에서부터 여섯 개를 잘랐다. 숫자만으로는 그 값이 무슨
 * 소리를 뜻하는지 알 수 없고, 앞 여섯 개가 꼭 그 곡을 설명하는 축도 아니다 — 0 근처에 있는
 * 축은 아무 말도 안 해 준다. 지도가 겹마다 쓰는 축 이름을 그대로 가져와(`pcAxisLabel`)
 * 사용자가 보는 말과 지도를 맞추고, **치우친 순서**로 세워 위 셋만 먼저 보인다.
 *
 * 치우침은 원값 크기가 아니라 **축별 표준편차로 나눈 값**으로 잰다. 축마다 흩어진 폭이
 * 달라서(PC1 은 ±20 대, PC8 은 ±1 대) 원값끼리 견주면 폭이 큰 축이 늘 이긴다. 잣대는
 * 지도가 들고 있는 이 겹 상주 집합이다 (`pcStats`).
 */
export default function SongPcList({ items }: SongPcListProps) {
  const [open, setOpen] = useState(false);
  const stats = getMapEngine()?.pcStats();

  const rows = items
    .map((p) => ({
      axis: p.axis,
      label: pcAxisLabel(p.axis, p.value),
      // 잣대가 아직 없으면(지도가 안 떴을 때) 원값 순서로라도 세운다
      sd: stats ? (p.value - stats.mean[p.axis]) / stats.sd[p.axis] : p.value,
    }))
    // 뜻이 없는 축(PC4 · PC12)은 뺀다 — 없는 의미를 지어 붙이면 그쪽으로 곡을 찾다가 헛수고한다
    .filter((p): p is typeof p & { label: string } => p.label != null)
    .sort((a, b) => Math.abs(b.sd) - Math.abs(a.sd));

  if (!rows.length) return null;
  const shown = open ? rows : rows.slice(0, TOP);
  const hidden = rows.length - TOP;

  return (
    <div className="flex flex-col gap-2">
      <SectionTitle aside={`치우친 순 ${shown.length}/${rows.length}`}>고정 주성분</SectionTitle>
      <div className="flex flex-col gap-[7px]">
        {shown.map((pc) => (
          <ProgressBar
            key={pc.axis}
            label={pc.label}
            code={`PC${pc.axis + 1}`}
            percent={((Math.max(-FULL_SD, Math.min(FULL_SD, pc.sd)) / FULL_SD + 1) / 2) * 100}
            valueText={`${pc.sd > 0 ? "+" : ""}${pc.sd.toFixed(1)}σ`}
          />
        ))}
      </div>
      {hidden > 0 && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="self-start text-[11px] text-ink-3 transition-colors hover:text-ink">
          {open ? "접기" : `더보기 (${hidden})`}
        </button>
      )}
    </div>
  );
}
