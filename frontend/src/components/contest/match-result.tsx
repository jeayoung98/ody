import Note from "@/components/common/note";
import SectionTitle from "@/components/common/section-title";
import Tag from "@/components/common/tag";
import TrackRow from "@/components/common/track-row";
import { MATCH_QUALITY_LABEL } from "@/constants";
import type { ContestMatch } from "@/types";

const TONE = { HIGH: "teal", MEDIUM: "violet", LOW: "warn" } as const;

/**
 * 매칭으로 찾은 곡 목록 — 순서 = 점을 찍은 순서 (S15P21A405-598). AI 추천 모양(595)이면 그 모양의 이름과 적합도를 대신 적는다.
 * 점수는 **모양 일치도**다 — AI 채점이 아니다. 그건 출품 뒤 서버가 따로 한다 (S15P21A405-640).
 */
export default function MatchResult({ match, className = "" }: { match: ContestMatch; className?: string }) {
  const tpl = match.template;
  // 부모가 높이를 주면(`min-h-0 flex-1`) 곡 목록만 그 안에서 스크롤한다 (S15P21A405-665) — 머리와 안내는 고정
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <SectionTitle
        aside={
          <Tag tone={TONE[match.quality]} title={tpl ? "템플릿 모양에 곡이 얼마나 정확히 놓였나 (0~100). AI 채점과는 별개예요" : "그린 모양과 찾은 배치가 얼마나 닮았나 (0~100). AI 채점과는 별개예요"}>
            {tpl ? "정확도" : `닮음 ${MATCH_QUALITY_LABEL[match.quality]}`} · <span className="num">{match.score}</span>
          </Tag>
        }
      >
        {tpl ? `AI 추천 · ${tpl.label}` : `찾은 별 ${match.tracks.length}개`}
      </SectionTitle>
      {!tpl && match.quality === "LOW" && <Note>모양이 많이 달라요. 점을 고쳐 다시 찾아 볼 수 있어요 — 이대로 출품해도 돼요.</Note>}
      {tpl && <Note>플레이리스트 「{tpl.playlistName}」이 이미 만들어졌어요. 출품하면 아래 이름으로 바뀌어요.</Note>}
      <div className="scroll-quiet -mx-1.5 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {match.tracks.map((t, i) => (
          <TrackRow key={t.musicId} index={i + 1} title={t.title ?? "알 수 없는 곡"} artist={t.artist} />
        ))}
      </div>
    </div>
  );
}
