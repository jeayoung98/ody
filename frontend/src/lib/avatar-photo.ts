"use client";

/**
 * 헬멧 바이저 안에 넣을 **진짜 프로필 사진** (S15P21A405-536).
 *
 * 캔버스는 `<img>` 처럼 주소만 주면 알아서 그려 주지 않는다 — 다 받아 둔 이미지가 있어야 한다.
 * 그래서 받아 두고, 아직이면 `null` 을 준다. 부르는 쪽은 그동안 절차적 그림을 쓴다.
 *
 * **지도는 이 함수를 매 프레임 부른다.** 그래서 실패를 주소 단위로 굳힌다 — 없는 사진을 초당
 * 예순 번 다시 두드리면 그것만으로 네트워크 탭이 가득 찬다.
 */

const ready = new Map<string, HTMLImageElement>();
const failed = new Set<string>();
const loading = new Set<string>();
const waiters = new Set<() => void>();

/**
 * 사진 한 장이 도착했다고 알린다.
 *
 * 지도는 계속 다시 그리니 알림이 필요 없지만, **한 번 그리고 마는 쪽**(`HelmetAvatar`)은
 * 이 신호가 없으면 절차적 그림인 채로 굳는다.
 */
export function onPhotoLoaded(cb: () => void): () => void {
  waiters.add(cb);
  return () => {
    waiters.delete(cb);
  };
}

/** 받아 둔 사진. 없으면 받기 시작하고 `null` — 다음 그리기부터 진짜 사진이 나온다 */
export function photoFor(url: string | null | undefined): HTMLImageElement | null {
  if (!url) return null;
  const hit = ready.get(url);
  if (hit) return hit;
  if (failed.has(url) || loading.has(url)) return null;

  loading.add(url);
  const img = new Image();
  /**
   * **캔버스가 오염되면 안 된다.** 이 그림이 들어간 캔버스를 나중에 `toDataURL` 로 읽는 자리가
   * 지금은 없지만(호버 카드·배경은 커버 캔버스를 읽는다), 오염은 읽는 쪽에서 예외로 터지고
   * 그린 쪽에는 아무 표시가 없어 원인을 찾기 어렵다. 구글 프로필 사진은 ACAO 를 준다.
   */
  img.crossOrigin = "anonymous";
  img.onload = () => {
    loading.delete(url);
    // 오래 돌면 사람이 계속 들고 난다. 통째로 비우고 다시 받는 편이 관리보다 싸다
    if (ready.size > 200) ready.clear();
    ready.set(url, img);
    for (const cb of waiters) cb();
  };
  img.onerror = () => {
    loading.delete(url);
    failed.add(url);
  };
  img.src = url;
  return null;
}

/**
 * 정사각 자리에 **가운데를 잘라** 넣는다.
 *
 * 사진은 정사각이 아니다(쿼카 사진은 16:9 다). 통째로 늘리면 얼굴이 눌리므로 짧은 변에 맞춰
 * 가운데를 딴다 — CSS 의 `object-fit: cover` 와 같은 계산이고, 목록의 동그란 사진과 헬멧 안의
 * 사진이 같아 보이려면 같은 방식이어야 한다.
 */
export function drawCropped(g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, size: number): void {
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  g.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, x, y, size, size);
}
