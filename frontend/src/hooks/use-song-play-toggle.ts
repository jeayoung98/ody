"use client";

import { usePlayability } from "@/hooks/queries/use-video-id-query";
import { usePlaySong } from "@/hooks/use-play-song";
import { usePlayerStore } from "@/stores/use-player-store";
import { useToastStore } from "@/stores/use-toast-store";

/**
 * 곡 상세의 재생 버튼이 쓰는 한 벌 — 지금 이 곡이 울리는지, 누르면 무엇을 할지.
 *
 * 곡 상세에는 재생 버튼이 둘이다(제목 줄 옆 · 본문). 둘이 각자 판단하면 한쪽만 `정지` 로
 * 바뀌는 식으로 엇갈리므로 **판단을 여기 한 곳에 둔다** (S15P21A405-384).
 */
export function useSongPlayToggle(musicId: number) {
  const playWithConfirm = usePlaySong();
  const pause = usePlayerStore((s) => s.pause);
  const currentMusicId = usePlayerStore((s) => s.currentMusicId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const showToast = useToastStore((s) => s.show);

  /**
   * 들을 수 있는 곡인가 — 판단과 문구는 `usePlayability` 한 곳에서 온다 (S15P21A405-364).
   *
   * 예전에는 `videoId` 가 없으면 유튜브 검색 링크를 새 탭으로 열었다. 탭이 열리면 탐색 흐름이
   * 끊겨서 그 길을 걷어냈다. 이제 사이트 안에서 못 트는 곡은 `재생 불가` 다 (SONG-04).
   */
  const { canPlay, blocked, retry } = usePlayability(musicId);

  /** 지금 이 곡이 울리고 있나 — 버튼이 상태를 보여줘야 또 누르지 않는다 (S15P21A405-325) */
  const isThisPlaying = canPlay && currentMusicId === musicId && isPlaying;

  /**
   * **사이트 안에서** 듣는다 — 하단의 공식 플레이어가 스토어를 보고 재생한다.
   * 앱에는 "이 곡을 듣는 중" 상태가 남아 내 표식이 그 곡으로 이동한다 (MAP-08).
   *
   * 울리는 중에 다시 누르면 멈춘다 — 라벨이 `정지` 인데 눌러도 안 멈추면 고장으로 읽힌다.
   */
  const toggle = () => {
    /**
     * 못 트는 곡이면 **왜 안 되는지 알려 준다** (S15P21A405-336). 예전에는 버튼이 꺼져 있어
     * 눌러도 아무 일도 안 났다 — 아래 안내문을 못 본 사람에게는 고장으로 보인다.
     */
    if (blocked) {
      showToast(blocked.notice);
      // 아직 안 찾아본 곡·조회 실패는 다시 부르면 채워질 수 있다 (S15P21A405-332)
      if (blocked.retryable) retry();
      return;
    }
    if (isThisPlaying) {
      pause();
      return;
    }
    // 순차 재생 중 목록 밖의 곡이면 먼저 물어본다 (S15P21A405-341)
    // 선언은 `use-declare-play` 한 곳이 한다 (S15P21A405-569) — 여기서 또 부르면 두 번 나간다
    playWithConfirm(musicId);
  };

  return { canPlay, blocked, isThisPlaying, toggle };
}
