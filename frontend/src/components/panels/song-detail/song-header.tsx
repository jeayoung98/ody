"use client";

import Tag from "@/components/common/tag";
import { genreColor } from "@/constants/design-tokens";
import { useVideoIdQuery } from "@/hooks/queries/use-video-id-query";
import { formatCount, formatDuration } from "@/lib/format";
import type { MusicDetail } from "@/types";
import SongHero from "./song-hero";

/**
 * 곡 상세 상단 — 앨범 히어로 + 칩(장르 색 · 무드 · 연도 · 길이 · 재생수 · 재생불가).
 *
 * 제목·아티스트·앨범은 히어로 안으로 들어갔다 (S15P21A405-314). 여기 남은 건 칩 줄이다.
 */
export default function SongHeader({ music }: { music: MusicDetail }) {
  const color = genreColor(music.genres[0]?.id ?? 0);
  const video = useVideoIdQuery(music.id);
  return (
    <div className="flex flex-col gap-2">
      <SongHero music={music} />
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
        {video.data && video.data.videoId == null && <Tag tone="warn">재생 불가</Tag>}
      </div>
    </div>
  );
}
