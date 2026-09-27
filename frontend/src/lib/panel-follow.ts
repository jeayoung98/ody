/**
 * 재생 곡이 바뀌었을 때 곡 상세 패널이 따라갈 곡 (S15P21A405-656). 순수 함수 — `tests/panel-follow.test.cjs` 가 묶는다.
 *
 * **직전 재생 곡을 보여 주고 있었을 때만** 따라간다. 사용자가(또는 인솔자가) 일부러 다른 곡의 상세를 열어 둔 것은
 * 그 사람의 선택이라 재생이 넘어가도 건드리지 않는다. 그 외(패널이 닫혔거나 다른 패널)면 `null`.
 */
export function panelFollowTarget(
  panel: { activePanel: string | null; musicId: number | null },
  prevMusicId: number | null,
  nextMusicId: number | null,
): number | null {
  if (nextMusicId == null || prevMusicId == null || prevMusicId === nextMusicId) return null;
  if (panel.activePanel !== "song" || panel.musicId !== prevMusicId) return null;
  return nextMusicId;
}
