"use client";

import { PauseIcon, PlayIcon } from "@/components/common/icons";
import MarqueeText from "@/components/common/marquee-text";
import Tag from "@/components/common/tag";
import TransportButton from "@/components/common/transport-button";
import { genreColor } from "@/constants/design-tokens";
import { useSongPlayToggle } from "@/hooks/use-song-play-toggle";
import { formatCount, formatDuration } from "@/lib/format";
import type { MusicDetail } from "@/types";

/**
 * 곡 상세 상단 — 제목·아티스트·앨범 + 재생 버튼 + 칩(장르 색 · 무드 · 연도 · 길이 · 재생수 · 재생불가).
 *
 * 배경 커버는 여기 없다. 커버는 패널 배경에 고정으로 깔리고(`song-cover-backdrop`), 이 글자는
 * 상세 내용과 **함께 스크롤되는 시트의 맨 위**다 (S15P21A405-384). 시트 윗머리는 아직 커버가
 * 비치는 자리라 글자에 그림자를 남긴다.
 *
 * 재생 버튼은 하단 플레이어바의 그것과 **같은 물건**이다(`TransportButton primary`) — 같은
 * 동작에 다른 모양을 주지 않는다.
 */
export default function SongHeader({ music }: { music: MusicDetail }) {
  const color = genreColor(music.genres[0]?.id ?? 0);
  const { blocked, isThisPlaying, toggle } = useSongPlayToggle(music.id);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        {/* 긴 제목은 잘리지 않고 옆으로 흐른다 */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <MarqueeText
            text={music.title}
            className="font-display text-3xl leading-[1.2] font-semibold text-ink drop-shadow-[0_2px_8px_rgba(4,6,13,.85)]"
          />
          <MarqueeText text={music.artist ?? "Unknown"} className="text-sm text-ink-2 drop-shadow-[0_1px_6px_rgba(4,6,13,.9)]" />
          {music.album && <MarqueeText text={music.album} className="text-xs text-ink-3 drop-shadow-[0_1px_6px_rgba(4,6,13,.9)]" />}
        </div>
        <TransportButton label={isThisPlaying ? "정지" : "재생"} primary dimmed={!!blocked} onClick={toggle}>
          {isThisPlaying ? <PauseIcon size={17} /> : <PlayIcon size={17} />}
        </TransportButton>
      </div>
      <div className="flex flex-wrap gap-[5px]">
        {music.genres.map((g) => (
          <Tag key={g.id} color={color}>
            {g.name}
          </Tag>
        ))}
        {(music.moods ?? []).map((m) => (
          <Tag key={m} tone="teal">
            {m}
          </Tag>
        ))}
        {music.releaseYear && <Tag>{music.releaseYear}</Tag>}
        <Tag>{formatDuration(music.duration)}</Tag>
        <Tag tone="violet">▶ {formatCount(music.playCnt)}</Tag>
        {/* videoId 는 전용 엔드포인트가 출처다 (S15P21A405-340). 아직 모르는 동안에는 붙이지 않는다 */}
        {blocked && <Tag tone="warn">{blocked.badge}</Tag>}
      </div>
    </div>
  );
}
