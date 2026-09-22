"use client";

import { useEffect, useRef } from "react";
import { useRecordPlayMutation } from "@/hooks/mutations/use-record-play-mutation";
import { playSourceOf, shouldDeclare } from "@/lib/play-declare";
import { isRiding } from "@/stores/use-follow-store";
import { useMapStore } from "@/stores/use-map-store";
import { usePlayerStore } from "@/stores/use-player-store";

/**
 * 재생 선언을 보내는 **유일한 자리** (S15P21A405-569).
 *
 * 예전에는 화면 다섯 곳이 각자 `useRecordPlayMutation` 을 불렀다. 그중 셋(여정·플리·주변
 * 탐색)은 `ids` 전부를 큐에 넣고 **`ids[0]` 하나만** 서버에 말했고, 큐가 자동으로 넘어가는
 * 길 셋(곡 끝남·못 트는 곡 건너뜀·다음 버튼)에는 아무도 없었다. 그래서 열 곡짜리 목록을
 * 돌려도 서버는 1번 곡만 알았다.
 *
 * 그 여덟 갈래가 전부 **`currentMusicId` 를 바꾸는 것**으로 끝난다. 그러니 거기 한 번 걸면
 * 다 덮인다.
 *
 * **한 번만 마운트한다** (`map-view`). 두 군데서 걸면 곡마다 두 번 선언한다.
 */
export function useDeclarePlay(): void {
  const declare = useRecordPlayMutation();
  /** 직전에 선언한 번호. 같은 번호를 두 번 보내지 않는다 */
  const sent = useRef<number | null>(null);

  useEffect(() => {
    /**
     * **스토어 구독이지 `useEffect` 의존성이 아니다.** 의존성으로 걸면 `declare` 가 매 렌더
     * 새 객체라 효과가 계속 다시 돌고, 그 안에서 조건을 또 따져야 한다. 구독은 값이 실제로
     * 바뀐 순간만 알려 준다.
     */
    return usePlayerStore.subscribe((s) => {
      if (!shouldDeclare({ musicId: s.currentMusicId, declareSeq: s.declareSeq, lastSeq: sent.current, riding: isRiding() })) return;
      sent.current = s.declareSeq;
      /**
       * `layer` 는 **첫 재생일 때만** 쓰인다 — 이미 지도에 서 있으면 서버가 무시한다.
       * 그래도 항상 넣는다. 빠지면 첫 배치에서 422 다.
       */
      declare.mutate({ musicId: s.currentMusicId!, source: playSourceOf(s.context.kind), layer: useMapStore.getState().layer });
    });
    // `declare` 는 마운트 동안 같은 뮤테이션을 가리킨다 — 구독을 다시 걸 이유가 없다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
