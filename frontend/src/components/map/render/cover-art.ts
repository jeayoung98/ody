"use client";

/**
 * 진짜 앨범 커버 — Cover Art Archive (S15P21A405-518).
 *
 * 백엔드가 주는 `albumMbid`(MusicBrainz 릴리스 ID) 하나로 주소가 완성된다. 중간 조회도 API 키도
 * 없고 `Access-Control-Allow-Origin: *` 이라 브라우저에서 바로 받는다 (2026-09-21 실측).
 *
 * **유튜브 썸네일로 하려다 접었다** (S15P21A405-516·517). 그건 앨범 아트가 아니라 영상
 * 썸네일이라, 자동생성(Topic) 영상만 앨범 그림이고 나머지는 영상 장면이었다 — 실데이터
 * 16곡 중 절반이 번호판 사진·인물 스틸 같은 것이었다. `albumMbid` 는 앨범 그 자체를 가리킨다.
 */

/** 500px 원본. 지도 커버(≈33px)에도 상세 배경(376px)에도 이 한 장이면 충분하다 */
const RELEASE = (mbid: string) => `https://coverartarchive.org/release/${mbid}/front-500`;
/**
 * 릴리스에 그림이 없을 때 한 번 더 두드리는 곳.
 *
 * 백엔드가 릴리스 ID 를 준다는 전제지만, **릴리스 그룹 ID 가 와도 돌아가게** 둔다 — 둘은
 * 생김새가 같은 UUID 라 값만 보고는 구분할 수 없고, 잘못 짚었을 때 커버가 통째로 안 뜬다.
 */
const RELEASE_GROUP = (mbid: string) => `https://coverartarchive.org/release-group/${mbid}/front-500`;

/** 캐시 키 — 같은 곡도 쓰는 자리마다 크기가 다르다 (지도는 작게, 상세 배경은 크게) */
const keyOf = (musicId: number, size: number) => `${musicId}:${size}`;

const ready = new Map<string, HTMLCanvasElement>();
const failed = new Set<number>();
const loading = new Set<string>();

function bake(img: HTMLImageElement, size: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  // CAA 는 정사각이 아닐 수 있다 (스캔본은 살짝 눌려 온다). 가운데를 잘라 정사각으로 맞춘다
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  g.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
  return c;
}

/**
 * 이 곡의 앨범 커버. 아직 안 왔으면 `null` 이고, 그 동안 부르는 쪽은 절차적 커버를 쓴다.
 * 처음 물어볼 때 받기 시작하고, 끝나면 다음 프레임부터 이 함수가 캔버스를 준다.
 */
export function albumCover(musicId: number, albumMbid: string | null | undefined, size: number): HTMLCanvasElement | null {
  if (!albumMbid) return null;
  const key = keyOf(musicId, size);
  const hit = ready.get(key);
  if (hit) return hit;
  if (failed.has(musicId) || loading.has(key)) return null;

  loading.add(key);
  const load = (url: string, onFail: () => void) => {
    const img = new Image();
    // CAA 가 ACAO * 를 준다. 이게 없으면 캔버스가 오염돼 호버 카드의 toDataURL() 이 던진다
    img.crossOrigin = "anonymous";
    img.onload = () => {
      loading.delete(key);
      if (ready.size > 300) ready.clear();
      ready.set(key, bake(img, size));
    };
    img.onerror = onFail;
    img.src = url;
  };
  load(RELEASE(albumMbid), () =>
    load(RELEASE_GROUP(albumMbid), () => {
      // 둘 다 없으면 이 곡은 포기한다 — 매 프레임 다시 두드리지 않게 곡 단위로 굳힌다
      loading.delete(key);
      failed.add(musicId);
    }),
  );
  return null;
}

/** 커버 그림이 실제로 와 있는가 (지도가 커버 자리를 줄 곡을 고를 때 쓴다) */
export function hasAlbumCover(musicId: number, size: number): boolean {
  return ready.has(keyOf(musicId, size));
}
