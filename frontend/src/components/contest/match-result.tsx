import SectionTitle from "@/components/common/section-title";
import Tag from "@/components/common/tag";
import TrackRow from "@/components/common/track-row";
import { MATCH_QUALITY_LABEL } from "@/constants";
import type { ContestMatch } from "@/types";

const TONE = { HIGH: "teal", MID: "violet", LOW: "warn" } as const;

/** 매칭으로 찾은 곡 목록 — 순서 = 점을 찍은 순서 (S15P21A405-598) */
export default function MatchResult({ match }: { match: ContestMatch }) {
  return (
    <div className="flex flex-col gap-2">
      <SectionTitle
        aside={
          <Tag tone={TONE[match.quality]} title="그린 모양과 찾은 배치가 얼마나 닮았나">
            닮음 {MATCH_QUALITY_LABEL[match.quality]} · <span className="num">{Math.round(match.similarity * 100)}%</span>
          </Tag>
        }
      >
        찾은 별 {match.tracks.length}개
      </SectionTitle>
      <div className="-mx-1.5 flex flex-col gap-0.5">
        {match.tracks.map((t, i) => (
          <TrackRow key={t.musicId} index={i + 1} title={t.title} artist={t.artist} />
        ))}
      </div>
    </div>
  );
}
