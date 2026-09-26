"use client";

import { useEffect, type RefObject } from "react";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { coverFor } from "@/components/map/render/sprites";
import { NO_GENRE_ID } from "@/constants";
import { useMusicDetailQuery } from "@/hooks/queries/use-music-detail-query";

/**
 * 곡의 앨범 커버를 `ref` 상자의 배경으로 칠한다 — 곡 상세 배경과 플레이어바 배경이 같이 쓴다 (S15P21A405-704).
 *
 * **진짜 앨범 커버가 있으면 그걸 깐다** (S15P21A405-518). 백엔드가 주는 `albumMbid` 로 Cover Art Archive 에서 받는다.
 * 없으면 지도가 쓰는 **절차적 커버**로 떨어진다 — 커버 색이 별 색에서 나오므로(`sprites.ts`) 따로 그리면 같은 곡이
 * 지도와 여기서 다른 그림으로 보인다.
 *
 * **지도가 이미 들고 있으면 그 값을 쓴다** (S15P21A405-527). 별을 누른 순간 상주 집합에 `albumMbid` 가 있으므로,
 * 상세 응답을 기다리면 이미 받아 둔 그림을 두고 화면만 비운다. 상세 쿼리는 지도에 없는 곡(고스트·검색 결과)의
 * 폴백이다 — 곡 상세·플레이어바가 어차피 부르는 쿼리라 요청이 새로 나가지도 않는다.
 *
 * 캔버스는 브라우저에만 있다. 상태로 들고 있으면 서버 렌더와 값이 달라 하이드레이션이 깨지고, effect 안 setState 는
 * lint 가 막는다. 그래서 **DOM 에 직접 칠한다.**
 *
 * `genreId` 는 지금 쓰이지 않는다 — `starColorIdx` 가 실데이터에 장르가 거의 없어서 `musicId` 해시로 색을 뽑는다
 * (`star-look.ts` 의 `STAR_LOOK.randomColor`). 그 스위치가 내려가면 여기에도 진짜 `genreId` 를 넘겨야 지도와 색이 맞는다.
 *
 * @param musicId null 이면 배경을 비운다 (플레이어바가 아무것도 안 트는 동안)
 * @param size 굽는 크기(px). 원본이 500px 라 그보다 키워 봐야 소용없다
 */
export function useAlbumCover(ref: RefObject<HTMLElement | null>, musicId: number | null, size: number): void {
  const fromMap = musicId != null ? (getMapEngine()?.pointOf(musicId)?.albumMbid ?? null) : null;
  const fromDetail = useMusicDetailQuery(musicId).data?.albumMbid ?? null;
  const albumMbid = fromMap ?? fromDetail;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (musicId == null) {
      el.style.backgroundImage = "";
      return;
    }
    let timer = 0;
    const paint = () => {
      const canvas = coverFor({ musicId, genreId: NO_GENRE_ID, pc: [], weight: 1, title: "", artist: null, youtubeUrl: null, albumMbid, playable: true }, size);
      el.style.backgroundImage = `url(${canvas.toDataURL()})`;
    };
    paint();
    /**
     * 진짜 커버는 **받은 뒤에** 캔버스가 된다. 지도는 rAF 로 계속 다시 그려서 저절로 바뀌지만 여기는 한 번 칠하고
     * 끝이라, 도착했는지 잠깐 되물어 본다. 이미 있으면 첫 칠에서 끝난다.
     */
    let tries = 0;
    const poll = () => {
      timer = 0;
      if (!albumMbid || tries++ > 40) return;
      paint();
      timer = window.setTimeout(poll, 150);
    };
    timer = window.setTimeout(poll, 150);
    return () => clearTimeout(timer);
  }, [ref, musicId, albumMbid, size]);
}
