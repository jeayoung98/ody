import Note from "@/components/common/note";
import SectionTitle from "@/components/common/section-title";
import Tag from "@/components/common/tag";
import TrackRow from "@/components/common/track-row";
import { MATCH_QUALITY_LABEL } from "@/constants";
import type { ContestMatch } from "@/types";

const TONE = { HIGH: "teal", MEDIUM: "violet", LOW: "warn" } as const;

/**
 * 매칭으로 찾은 곡 목록 — 순서 = 점을 찍은 순서 (S15P21A405-598).
 * 점수는 **모양 일치도**다 — AI 채점이 아니다. 그건 출품 뒤 서버가 따로 한다 (S15P21A405-640).
 */
export default function MatchResult({ match }: { match: ContestMatch }) {
  return (
    <div className="flex flex-col gap-2">
      <SectionTitle
        aside={
          <Tag tone={TONE[match.quality]} title="그린 모양과 찾은 배치가 얼마나 닮았나 (0~100). AI 채점과는 별개예요">
            닮음 {MATCH_QUALITY_LABEL[match.quality]} · <span className="num">{match.score}</span>
          </Tag>
        }
      >
        찾은 별 {match.tracks.length}개
      </SectionTitle>
      {match.quality === "LOW" && <Note>모양이 많이 달라요. 점을 고쳐 다시 찾아 볼 수 있어요 — 이대로 출품해도 돼요.</Note>}
      <div className="-mx-1.5 flex flex-col gap-0.5">
        {match.tracks.map((t, i) => (
          <TrackRow key={t.musicId} index={i + 1} title={t.title ?? "알 수 없는 곡"} artist={t.artist} />
        ))}
      </div>
    </div>
  );
}
