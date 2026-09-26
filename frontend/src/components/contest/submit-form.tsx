"use client";

import Note from "@/components/common/note";
import TextInput from "@/components/common/text-input";
import { SKETCH_RULES } from "@/constants";
import { useContestStore } from "@/stores/use-contest-store";
import type { Contest, ContestEntry, ContestMatch } from "@/types";

interface SubmitFormProps {
  contest: Contest;
  match: ContestMatch;
  /** 이미 낸 내 작품. 있으면 다시 내는 것이고 **이전 것이 지워진다** */
  my: ContestEntry | null;
  /** Enter 로 출품 — 버튼은 그리기 탭 오른쪽 아래에 있다 (`useContestSubmit`) */
  onSubmit: () => void;
}

/**
 * 별자리 이름 입력 (S15P21A405-640 · 702). 이름 = 만들어지는 플레이리스트 이름이다.
 * 출품 버튼은 여기 없다 — 그리기 탭의 모든 단계가 같은 자리(오른쪽 아래)에 다음 동작을 둔다.
 */
export default function SubmitForm({ contest, match, my, onSubmit }: SubmitFormProps) {
  const title = useContestStore((s) => s.title);
  const setTitle = useContestStore((s) => s.setTitle);
  const { titleMax } = SKETCH_RULES;

  return (
    <div className="flex flex-col gap-2">
      <label className="lbl" htmlFor="contest-title">
        별자리 이름
      </label>
      <TextInput
        id="contest-title"
        autoFocus
        value={title}
        maxLength={titleMax}
        placeholder={match.template ? match.template.playlistName : `예: 창가의 회색 ${contest.theme}`}
        autoComplete="off"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
      />
      <p className="num -mt-1 text-right text-[12.5px] text-ink-4">
        {title.length} / {titleMax}
      </p>
      {my && <Note>이미 「{my.title}」을 냈어요. 다시 내면 이전 작품이 지워지고 점수·좋아요가 초기화돼요.</Note>}
    </div>
  );
}
