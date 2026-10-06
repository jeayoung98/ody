import Note from "@/components/common/note";
import SectionTitle from "@/components/common/section-title";
import Tag from "@/components/common/tag";
import TrackRow from "@/components/common/track-row";
import { MATCH_QUALITY_LABEL } from "@/constants";
import type { ContestMatch } from "@/types";

const TONE = { HIGH: "teal", MEDIUM: "violet", LOW: "warn" } as const;

interface MatchResultProps {
  match: ContestMatch;
  className?: string;
  /** 곡에 마우스를 올리면 그 순번을 알린다 — 캔버스가 그 별에 고리를 두른다 (S15P21A405-693) */
  onHover?: (index: number | null) => void;
  /** 안내 문구를 목록 위에 붙일지. 그리기 탭은 판 아래 설명 자리에 따로 적어 끈다 (S15P21A405-702) */
  showNote?: boolean;
}

/**
 * 이 별자리에 들어갈 곡 — 순서 = 점을 찍은 순서 (S15P21A405-598 · 693). 출품하면 이 곡들로 플레이리스트가 만들어진다.
 *
 * **모양 일치도는 숫자 없이 말로만 적는다** (S15P21A405-693). 숫자를 붙였더니 출품 뒤 AI 점수(역시 100점 만점)와
 * 같은 점수로 읽혔다. 화면에 숫자 점수는 AI 점수 하나뿐이다.
 */
export default function MatchResult({ match, className = "", onHover, showNote = true }: MatchResultProps) {
  const tpl = match.template;
  // 부모가 높이를 주면(`min-h-0 flex-1`) 곡 목록만 그 안에서 스크롤한다 (S15P21A405-665) — 머리와 안내는 고정
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <SectionTitle aside={<Tag tone={TONE[match.quality]}>{MATCH_QUALITY_LABEL[match.quality]}</Tag>}>
        이 별자리에 들어갈 곡 {match.tracks.length}개
      </SectionTitle>
      {showNote && <Note>
        {tpl
          ? `AI 추천 「${tpl.label}」 모양대로 고른 곡이에요. 플레이리스트 「${tpl.playlistName}」은 이미 만들어졌고, 출품하면 아래에 적은 이름으로 바뀌어요.`
          : "점을 찍은 순서대로 한 점에 한 곡씩 골랐어요. 번호가 캔버스의 별 번호예요. 출품하면 이 곡들로 플레이리스트가 만들어져요."}
        {!tpl && match.quality === "LOW" && " 점을 고쳐 다시 찾아볼 수 있어요 — 이대로 출품해도 돼요."}
      </Note>}
      <div className="scroll-quiet -mx-1.5 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto" onMouseLeave={() => onHover?.(null)}>
        {match.tracks.map((t, i) => (
          <div key={t.musicId} onMouseEnter={() => onHover?.(i)}>
            <TrackRow index={i + 1} title={t.title ?? "알 수 없는 곡"} artist={t.artist} />
          </div>
        ))}
      </div>
    </div>
  );
}
