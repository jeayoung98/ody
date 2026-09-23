"use client";

import { useState } from "react";
import { CalendarIcon, ClockIcon, HeartIcon, PauseIcon, PlaylistAddIcon, PlayIcon } from "@/components/common/icons";
import MarqueeText from "@/components/common/marquee-text";
import Tag from "@/components/common/tag";
import TransportButton from "@/components/common/transport-button";
import { PLAYBACK_BLOCKED } from "@/constants";
import { useLikeMusicMutation } from "@/hooks/mutations/use-like-music-mutation";
import { useFeatures } from "@/hooks/use-features";
import { useIsNarrow } from "@/hooks/use-is-narrow";
import { useSongPlayToggle } from "@/hooks/use-song-play-toggle";
import { formatCount, formatDuration } from "@/lib/format";
import { usePanelStore } from "@/stores/use-panel-store";
import type { MusicDetail } from "@/types";
import AddToPlaylistMenu from "../playlist/add-to-playlist-menu";

/**
 * 곡 상세 상단 — 제목·아티스트·앨범 + 행동 버튼 + 칩(장르 색 · 무드 · 연도 · 길이 · 재생수 · 재생불가).
 *
 * 배경 커버는 여기 없다. 커버는 패널 배경에 고정으로 깔리고(`song-cover-backdrop`), 이 글자는
 * 상세 내용과 **함께 스크롤되는 시트의 맨 위**다 (S15P21A405-384). 시트 윗머리는 아직 커버가
 * 비치는 자리라 글자에 그림자를 남긴다.
 *
 * **이 곡 하나에 대한 행동은 제목 줄에 모은다** — 재생, 플리에 추가. 아래 행동 줄은 여정
 * (두 곡을 잇는 일)만 남는다 (`song-actions`). 버튼은 하단 플레이어바의 그것과 **같은
 * 물건**이고(`TransportButton`), 재생만 `primary` 로 두어 무엇이 주인지 드러낸다.
 *
 * 플리 메뉴는 이 블록 아래로 펼쳐진다 — 그래서 뿌리가 `relative` 다.
 */
export default function SongHeader({ music }: { music: MusicDetail }) {
  const features = useFeatures();
  const [menuOpen, setMenuOpen] = useState(false);
  /**
   * **목록을 열면 시트를 끝까지 올린다** (S15P21A405-547).
   *
   * 이 목록은 아래로 펼쳐지는데(`absolute top-full`), 1·2 단에서는 펼칠 자리가 시트 밖이라
   * **재생바(z-21)와 탭바(z-23) 밑으로 들어가 아랫부분이 잘렸다** (실측: 2 단에서 메뉴가
   * 711~782 에 떠서 시트가 끝나는 678 아래로 나갔다). 시트는 z-20 이라 그 둘을 못 이긴다.
   *
   * 재생바 쪽 같은 목록이 멀쩡한 이유는 거기서는 **위로** 펼치기 때문이다
   * (`player-bar.tsx` 의 `bottom-full`). 여기서 위로 뒤집으면 1·2 단에서는 시트 위쪽
   * 바깥으로 나가 같은 문제가 반대로 생긴다 — 238px 안에 184px 짜리 목록이 설 자리가 없다.
   *
   * 그래서 자리를 만든다. 플리를 고르려면 어차피 목록을 봐야 한다.
   */
  const narrow = useIsNarrow();
  const setSnap = usePanelStore((s) => s.setSnap);
  const toggleMenu = () => {
    const next = !menuOpen;
    setMenuOpen(next);
    if (next && narrow) setSnap(3);
  };
  const { blocked, isThisPlaying, toggle } = useSongPlayToggle(music.id);
  const like = useLikeMusicMutation();
  /**
   * **찾아봤는데 음원이 없는 곡** (S15P21A405-384). 다시 눌러도 답이 같으므로 재생도 플리 추가도
   * 아예 잠근다 — 흐리기만 하고 눌리게 두면 "될 것 같은데 안 되는" 버튼이 된다.
   * 아직 안 찾아봤거나 조회가 실패한 곡은 **모르는 것**이지 없는 게 아니라 그대로 눌린다.
   */
  const dead = blocked === PLAYBACK_BLOCKED.noVideo;
  return (
    <div className="relative flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        {/* 긴 제목은 잘리지 않고 옆으로 흐른다 */}
        <div className="mr-1 flex min-w-0 flex-1 flex-col gap-0.5">
          <MarqueeText
            text={music.title}
            className="font-display text-3xl leading-[1.2] font-semibold text-ink drop-shadow-[0_2px_8px_rgba(4,6,13,.85)]"
          />
          <MarqueeText text={music.artist ?? "Unknown"} className="text-sm text-ink-2 drop-shadow-[0_1px_6px_rgba(4,6,13,.9)]" />
          {/*
            앨범 줄은 **1 단에서 접는다** (S15P21A405-547). 1 단에 걸리는 것은 "무슨 곡인지와
            바로 누를 것" 까지다 — 제목·가수·＋·▶. 앨범까지 넣으면 한 줄이 반쯤 잘린 채
            걸린다. 접는 자리는 `globals.css` 의 `[data-snap="1"]` 규칙이다.
          */}
          {music.album && (
            <span data-sheet-album>
              <MarqueeText text={music.album} className="text-xs text-ink-3 drop-shadow-[0_1px_6px_rgba(4,6,13,.9)]" />
            </span>
          )}
        </div>
        {/* 좋아요 (S15P21A405-611). 못 트는 곡도 누를 수 있다 — 좋아하는 것과 들을 수 있는 것은 다른 일이다 */}
        <TransportButton label={music.liked ? "좋아요 취소" : "좋아요"} size="md" bright onClick={() => like.mutate({ musicId: music.id, liked: !music.liked })}>
          <HeartIcon size={17} filled={music.liked} className={music.liked ? "text-rose-400" : undefined} />
        </TransportButton>
        {/* 유저 테스트 동안 플리를 감췄다 (S15P21A405-333). 설문 모드를 끄면 돌아온다 (387) */}
        {features.playlist && (
          <TransportButton label={dead ? "재생할 수 없는 곡은 담을 수 없어요" : "플레이리스트에 추가"} size="md" bright disabled={dead} onClick={toggleMenu}>
            <PlaylistAddIcon size={17} />
          </TransportButton>
        )}
        <TransportButton label={dead ? "재생할 수 없는 곡이에요" : isThisPlaying ? "정지" : "재생"} primary disabled={dead} dimmed={!dead && !!blocked} onClick={toggle}>
          {isThisPlaying ? <PauseIcon size={17} /> : <PlayIcon size={17} />}
        </TransportButton>
      </div>
      {/*
        칩은 값만 적는다 — 이름까지 적으면 줄이 금세 넘친다. 대신 **무엇의 값인지 왼쪽 아이콘이
        먼저 말하고**(시계 = 곡 길이, 달력 = 발매년도, ▶ = 누적 재생), 마우스를 올리면 이름이
        글자로 뜬다 (S15P21A405-384). 장르·무드는 값 자체가 이름이라 아이콘이 필요 없다.
      */}
      {/*
        `data-sheet-chips` 는 **1 단에서 접으려고** 단 표식이다 (S15P21A405-547). 1 단에 걸리는
        것은 제목·가수와 ＋·▶ 까지고, 칩은 2 단부터다 — 안 접으면 줄 머리만 8px 걸쳐서 잘린
        채 보인다 (실측). 접는 규칙은 `globals.css` 의 `[data-snap="1"]` 에 있다.
      */}
      <div data-sheet-chips className="flex flex-wrap gap-[5px]">
        {/* 장르 칩은 걷어냈다 — 이름을 읽을 원천이 없어졌다 (S15P21A405-490, A-47) */}
        {(music.moods ?? []).map((m) => (
          <Tag key={m} tone="teal" title="무드">
            {m}
          </Tag>
        ))}
        {/*
          **조회수 · 길이 · 발매년도 순이다** (S15P21A405-547). 앞에 오는 것이 먼저 읽히는데,
          그 자리를 값이 없을 때가 잦은 발매년도가 쓰고 있었다 — 백엔드가 안 주면 칩이 아예
          빠져서 줄이 들쭉날쭉했다. 늘 있는 값부터 세운다.
        */}
        <Tag tone="violet" title="누적 재생">
          ▶ {formatCount(music.playCnt)}
        </Tag>
        <Tag title="곡 길이">
          <ClockIcon /> {formatDuration(music.duration)}
        </Tag>
        {/*
          발매년도. **백엔드가 아직 안 준다** — 상세 응답에 없어서 `toMusic` 이 null 로 못 박는다
          (BACKEND-NOTES). 값이 오기 시작하면 이 칩이 그대로 뜬다
        */}
        {music.releaseYear != null && (
          <Tag title="발매년도">
            <CalendarIcon /> {music.releaseYear}
          </Tag>
        )}
        {/* videoId 는 전용 엔드포인트가 출처다 (S15P21A405-340). 아직 모르는 동안에는 붙이지 않는다 */}
        {blocked && (
          <Tag tone="warn" title={blocked.notice}>
            {blocked.badge}
          </Tag>
        )}
      </div>
      {features.playlist && menuOpen && <AddToPlaylistMenu musicId={music.id} onDone={() => setMenuOpen(false)} />}
    </div>
  );
}
