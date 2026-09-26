"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { MapEngine } from "@/components/map/engine/map-engine";
import { useContestEntriesQuery } from "@/hooks/queries/use-contest-entries-query";
import { musicDetailQueryOptions } from "@/hooks/queries/use-music-detail-query";
import { anchorPair, toSkyShape, topEntries, type SkyShape } from "@/lib/contest-sky";
import { musicToMapPoint } from "@/lib/map-point";
import type { ContestEntry } from "@/types";

/**
 * 이벤트 탑 작품을 지도 엔진에 넣는다 (S15P21A405-684). 그리기·클릭은 엔진이 한다.
 *
 * 작품 좌표를 최상단 겹의 제자리로 옮기려면 **곡 둘의 실제 좌표**가 필요하다 (`lib/contest-sky`). 상주 집합에
 * 있으면 그걸 쓰고, 없으면 가장 멀리 떨어진 두 곡만 상세를 조회한다 — 작품당 많아야 두 번이고 상세는 캐시에 남는다.
 */
export function useContestSky(enabled: boolean, engine: MapEngine): void {
  const qc = useQueryClient();
  const { data } = useContestEntriesQuery(enabled);

  useEffect(() => {
    if (!enabled || !data) {
      engine.setContestSky([]);
      return;
    }
    let cancelled = false;
    const pc12 = async (musicId: number): Promise<{ x: number; y: number } | null> => {
      const resident = engine.pointOf(musicId);
      if (resident) return { x: resident.pc[0], y: resident.pc[1] };
      try {
        const point = musicToMapPoint(await qc.fetchQuery(musicDetailQueryOptions(musicId)));
        return point ? { x: point.pc[0], y: point.pc[1] } : null;
      } catch {
        return null;
      }
    };
    const shapeOf = async (entry: ContestEntry): Promise<SkyShape | null> => {
      const known = new Map<number, { x: number; y: number }>();
      for (const t of entry.tracks) {
        const p = engine.pointOf(t.musicId);
        if (p) known.set(t.musicId, { x: p.pc[0], y: p.pc[1] });
      }
      if (known.size < 2) {
        for (const t of anchorPair(entry.tracks) ?? []) {
          if (known.has(t.musicId)) continue;
          const p = await pc12(t.musicId);
          if (p) known.set(t.musicId, p);
        }
      }
      return toSkyShape(entry, known);
    };
    void Promise.all(topEntries(data.items).map(shapeOf)).then((shapes) => {
      if (!cancelled) engine.setContestSky(shapes.filter((s): s is SkyShape => s != null));
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, data, engine, qc]);
}
