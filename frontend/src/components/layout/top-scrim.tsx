/**
 * 폰 윗줄 뒤에 까는 **약한 검은 그늘** (S15P21A405-703).
 *
 * 윗줄의 검색 돋보기·주변 탐색·여정은 유리 없이 흰 아이콘만 떠 있다. 밝은 별이나 성운 위에
 * 오면 아이콘이 배경에 녹아 안 보였다 — 아이콘마다 판을 대는 대신 화면 꼭대기에 위에서 아래로
 * 옅어지는 그늘 한 겹을 깐다. 지도는 그대로 보이고 아이콘 뒤만 가라앉는다.
 *
 * 브랜드(z-20, 레이어 자취) 아래 · 지도 위다. 손을 받지 않는다. `data-hud` 를 달지 않는다 —
 * 달면 지도 엔진이 이 넓은 판을 피해 화면 밖 '나' 표식을 놓는다 (`map-view.tsx` 의 `setObstacles`).
 * 넓은 화면에는 그리지 않는다.
 */
export default function TopScrim() {
  return (
    <div
      aria-hidden
      data-top-scrim
      className="pointer-events-none absolute inset-x-0 top-0 z-[19] hidden h-[calc(var(--spacing-hud-t)+72px)] bg-gradient-to-b from-black/55 via-black/25 to-transparent max-tablet:block"
    />
  );
}
