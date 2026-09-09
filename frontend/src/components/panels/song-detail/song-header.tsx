import Tag from "@/components/common/tag";
import { genreColor } from "@/constants/design-tokens";
import { formatCount, formatDuration } from "@/lib/format";
import type { MusicDetail } from "@/types";

/** 제목/가수 · 앨범 커버 · 칩(장르 색 · 무드 · 연도 · 길이 · 재생수 · 재생불가) */
export default function SongHeader({ music }: { music: MusicDetail }) {
  const color = genreColor(music.genres[0]?.id ?? 0);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        <span
          className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[9px] text-xl text-ink/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,.14)]"
          style={{ background: music.albumCoverUrl ? undefined : `linear-gradient(140deg,${color},#13102a)` }}
        >
          {music.albumCoverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={music.albumCoverUrl} alt={music.album ?? ""} className="h-full w-full object-cover" />
          ) : (
            "♪"
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-xl leading-[1.25] font-semibold">{music.title}</h3>
          <p className="mt-0.5 truncate text-sm text-ink-2">{music.artist ?? "Unknown"}</p>
          <p className="truncate text-xs text-ink-3">{music.album ?? "-"}</p>
        </div>
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
        {music.youtubeUrl == null && <Tag tone="warn">재생 불가</Tag>}
      </div>
    </div>
  );
}
