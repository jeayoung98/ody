"use client";

import Button from "@/components/common/button";
import Note from "@/components/common/note";
import TextInput from "@/components/common/text-input";
import { useSubmitContestEntryMutation } from "@/hooks/mutations/use-submit-contest-entry-mutation";
import { useContestStore } from "@/stores/use-contest-store";
import { useToastStore } from "@/stores/use-toast-store";
import type { Contest, ContestJudge, ContestMatch } from "@/types";

interface SubmitFormProps {
  contest: Contest;
  match: ContestMatch;
  judge: ContestJudge | null;
}

/**
 * 이름을 짓고 **그 점수로** 출품한다. 이름이 비면 못 낸다.
 * 이미 낸 것이 있으면 대체(재출품)이고 횟수를 쓴다 — 표는 남는다.
 */
export default function SubmitForm({ contest, match, judge }: SubmitFormProps) {
  const title = useContestStore((s) => s.title);
  const setTitle = useContestStore((s) => s.setTitle);
  const closed = useContestStore((s) => s.closed);
  const clear = useContestStore((s) => s.clear);
  const setTab = useContestStore((s) => s.setTab);
  const toast = useToastStore((s) => s.show);
  const submit = useSubmitContestEntryMutation();

  const { titleMax, resubmitLimit } = contest.rules;
  const resubmitting = contest.myEntryId != null;
  const exhausted = resubmitting && contest.myResubmitsLeft <= 0;
  const trimmed = title.trim();
  const disabled = !trimmed || !judge || exhausted || submit.isPending;

  const handleSubmit = () => {
    if (disabled) return;
    submit.mutate(
      { contestId: contest.id, title: trimmed, tracks: match.tracks, closed },
      {
        onSuccess: (entry) => {
          toast(`「${entry.title}」 출품 완료 · AI ${entry.aiScore ?? "-"}점 · 갤러리에 올라갔어요`);
          clear();
          setTitle("");
          setTab("gallery");
        },
        onError: (e) => toast(e.message),
      },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="lbl" htmlFor="contest-title">
        별자리 이름
      </label>
      <TextInput
        id="contest-title"
        value={title}
        maxLength={titleMax}
        placeholder="예: 창가의 회색 고양이"
        autoComplete="off"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
      />
      <p className="num -mt-1 text-right text-[12.5px] text-ink-4">
        {title.length} / {titleMax}
      </p>
      <Button variant="primary" className="w-full" disabled={disabled} onClick={handleSubmit}>
        {submit.isPending ? "출품하는 중..." : exhausted ? "재출품 횟수를 모두 썼어요" : `${judge ? `${judge.score}점으로 ` : ""}${resubmitting ? "다시 출품하기" : "출품하기"}`}
      </Button>
      <Note>
        {resubmitting
          ? `이미 출품했어요. 다시 내면 이전 작품을 대체해요 · 남은 재출품 ${contest.myResubmitsLeft}회`
          : judge && !trimmed
            ? "별자리 이름을 지어 주면 출품할 수 있어요"
            : `회차당 출품 1개 · 재출품 ${resubmitLimit}회까지 · 이름 필수`}
      </Note>
    </div>
  );
}
