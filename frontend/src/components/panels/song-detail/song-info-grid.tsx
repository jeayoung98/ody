import SectionTitle from "@/components/common/section-title";
import Stat from "@/components/common/stat";
import { formatCount, formatDuration } from "@/lib/format";
import type { MusicDetail } from "@/types";

/** .kv 목록 — 발매 국가/언어 · 작곡가 · 작사가 · 발매년도 · 곡 길이 · 장르 · 무드 · 재생수 */
export default function SongInfoGrid({ music }: { music: MusicDetail }) {
  return (
    <div className="flex flex-col gap-2">
      <SectionTitle>정보</SectionTitle>
      <dl className="m-0">
        <Stat label="발매 국가 / 언어" value={`${music.country ?? "-"} / ${music.language ?? "-"}`} />
        <Stat label="작곡가" value={music.composer ?? "-"} />
        <Stat label="작사가" value={music.lyricist ?? "-"} />
        <Stat label="발매년도" value={music.releaseYear ?? "-"} numeric />
        <Stat label="곡 길이" value={formatDuration(music.duration)} numeric />
        <Stat label="BPM" value={music.bpm ?? "-"} numeric />
        <Stat label="장르" value={music.genres.map((g) => g.name).join(", ") || "-"} />
        <Stat label="무드" value={(music.moods ?? []).join(" · ") || "-"} />
        <Stat label="누적 재생" value={formatCount(music.playCnt)} numeric />
      </dl>
    </div>
  );
}
