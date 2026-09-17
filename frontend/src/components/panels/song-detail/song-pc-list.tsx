"use client";

import { useState } from "react";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { ChevronDownIcon } from "@/components/common/icons";
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
 *
 * 펼치기는 **가운데 홑화살 하나**다 (S15P21A405-384). `더보기 (11)` 같은 글자를 쓰지 않는다 —
 * 남은 개수는 제목 옆 `3/11` 이 이미 말한다. 펴면 화살이 돌아 위를 보고, 나머지 줄은
 * `grid-template-rows: 0fr → 1fr` 로 자라난다. 높이를 재지 않아도 되는 유일한 방법이라
 * (`max-height` 는 어림값을 박아야 하고 넘치면 잘린다) 줄 수가 몇이든 정확히 맞는다.
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
  const top = rows.slice(0, TOP);
  const rest = rows.slice(TOP);

  const bar = (pc: (typeof rows)[number]) => (
    <ProgressBar
      key={pc.axis}
      label={pc.label}
      code={`PC${pc.axis + 1}`}
      percent={((Math.max(-FULL_SD, Math.min(FULL_SD, pc.sd)) / FULL_SD + 1) / 2) * 100}
      valueText={`${pc.sd > 0 ? "+" : ""}${pc.sd.toFixed(1)}σ`}
    />
  );

  return (
    <div className="flex flex-col gap-2">
      <SectionTitle aside={`치우친 순 ${open ? rows.length : top.length}/${rows.length}`}>고정 주성분</SectionTitle>
      {/*
        위 셋과 펼친 나머지는 **한 줄 간격(7px)으로 이어져야 한다** — 사이를 벌리면 다른 목록
        둘로 보인다. 그래서 바깥 `gap-2` 가 둘 사이에 끼지 않게 한 겹으로 묶고, 간격은 안쪽
        `pt-[7px]` 하나로만 준다 (접히면 그 패딩째로 0 이 된다).
      */}
      <div>
        <div className="flex flex-col gap-[7px]">{top.map(bar)}</div>
        {rest.length > 0 && (
          <div className={`grid transition-[grid-template-rows] duration-normal ease-spring ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
            {/* 0fr 일 때 안쪽이 삐져나오지 않게 — 자라는 동안 잘리는 쪽이 이 칸이다 */}
            <div className="overflow-hidden">
              <div className="flex flex-col gap-[7px] pt-[7px]">{rest.map(bar)}</div>
            </div>
          </div>
        )}
      </div>
      {rest.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "고정 주성분 접기" : "고정 주성분 더보기"}
          className="grid h-7 w-full place-items-center rounded-box-xs text-ink-3 transition-colors duration-fast hover:bg-white/[.05] hover:text-ink"
        >
          <ChevronDownIcon className={`transition-transform duration-normal ease-spring ${open ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}
