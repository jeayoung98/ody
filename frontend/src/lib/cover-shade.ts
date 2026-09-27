/**
 * 플레이어바 배경 덮개 농도 (S15P21A405-704).
 *
 * 앨범 커버를 비치게 깔았더니 **밝은 커버에서 회색 글자가 묻혔다.** 덮개를 늘 진하게 두면 어두운 커버는 까맣게
 * 가려지고, 늘 옅게 두면 흰 커버 위에서 글자가 사라진다. 그래서 커버 평균 밝기만큼 덮개를 진하게 한다.
 *
 * - 까만 커버(밝기 0) → `min` — 앨범이 가장 잘 보인다
 * - 흰 커버(밝기 1) → `max` — 뒤가 비쳐도 글자 대비가 남는다
 */
export const COVER_SHADE = { min: 0.35, max: 0.8 } as const;

/** 밝기(0~1) → 덮개 투명도. 밖의 값은 끝에 붙인다 */
export function shadeForLuma(luma: number): number {
  const t = Math.min(1, Math.max(0, Number.isFinite(luma) ? luma : 0));
  return COVER_SHADE.min + (COVER_SHADE.max - COVER_SHADE.min) * t;
}

/**
 * 캔버스의 평균 밝기(0~1). 8×8 로 줄여 평균을 낸다 — 블러로 덮을 그림이라 대강이면 된다.
 * 읽지 못하면(오염된 캔버스 등) null 이고, 부르는 쪽은 덮개를 가장 진하게 둔다 — 글자가 안 보이는 것보다 낫다.
 */
export function canvasLuma(canvas: HTMLCanvasElement): number | null {
  try {
    const s = document.createElement("canvas");
    s.width = 8;
    s.height = 8;
    const g = s.getContext("2d", { willReadFrequently: true });
    if (!g) return null;
    g.drawImage(canvas, 0, 0, 8, 8);
    const d = g.getImageData(0, 0, 8, 8).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    return sum / (d.length / 4) / 255;
  } catch {
    return null;
  }
}
