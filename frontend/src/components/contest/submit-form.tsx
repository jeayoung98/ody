"use client";

import Button from "@/components/common/button";
import Note from "@/components/common/note";
import TextInput from "@/components/common/text-input";
import { SKETCH_RULES } from "@/constants";
import { useSubmitContestEntryMutation } from "@/hooks/mutations/use-submit-contest-entry-mutation";
import { roundPhase } from "@/lib/contest-view";
import { useContestStore } from "@/stores/use-contest-store";
import { useToastStore } from "@/stores/use-toast-store";
import type { Contest, ContestEntry, ContestMatch } from "@/types";

interface SubmitFormProps {
  contest: Contest;
  match: ContestMatch;
  /** 이미 낸 내 작품. 있으면 다시 내는 것이고 **이전 것이 지워진다** */
  my: ContestEntry | null;
  loggedIn: boolean;
  /** 출품이 받아들여졌다 — 그리기 탭이 내 작품 화면으로 넘어간다 (S15P21A405-693) */
  onSubmitted?: () => void;
}

/**
 * 이름을 짓고 출품한다 (S15P21A405-640). 이름 = 만들어지는 플레이리스트 이름이다.
 * AI 점수는 여기서 안 보인다 — 출품 뒤 서버가 매기고 `MyArtworkCard` 가 받아 보인다.
 * 재출품은 **교체**다: 서버가 이전 작품을 지우고 점수·좋아요를 초기화한다 (§6-3) — 누르기 전에 말해 준다.
 */
export default function SubmitForm({ contest, match, my, loggedIn, onSubmitted }: SubmitFormProps) {
  const title = useContestStore((s) => s.title);
  const setTitle = useContestStore((s) => s.setTitle);
  const closed = useContestStore((s) => s.closed);
  const clear = useContestStore((s) => s.clear);
  const toast = useToastStore((s) => s.show);
  const submit = useSubmitContestEntryMutation();

  const { titleMax } = SKETCH_RULES;
  const open = roundPhase(contest) === "OPEN";
  const trimmed = title.trim();
  const disabled = !trimmed || !loggedIn || !open || submit.isPending;

  const handleSubmit = () => {
    if (disabled) return;
    submit.mutate(
      match.template ? { title: trimmed, playlistId: match.template.playlistId, closed } : { title: trimmed, musicIds: match.tracks.map((t) => t.musicId), closed },
      {
        onSuccess: () => {
          toast(`「${trimmed}」 출품 완료 · AI 채점이 끝나면 알려 드려요`);
          clear();
          setTitle("");
          onSubmitted?.();
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
        placeholder={match.template ? match.template.playlistName : `예: 창가의 회색 ${contest.theme}`}
        autoComplete="off"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
      />
      <p className="num -mt-1 text-right text-[12.5px] text-ink-4">
        {title.length} / {titleMax}
      </p>
      <Button variant="primary" className="w-full" disabled={disabled} onClick={handleSubmit}>
        {submit.isPending ? "출품하는 중..." : !loggedIn ? "로그인하면 출품할 수 있어요" : !open ? "접수가 끝났어요" : my ? "다시 출품하기" : "출품하기"}
      </Button>
      <Note>
        {my
          ? `이미 「${my.title}」을 냈어요. 다시 내면 이전 작품이 지워지고 점수·좋아요가 초기화돼요.`
          : !trimmed
            ? match.template
              ? "별자리 이름을 지어 주면 그 이름으로 플레이리스트가 바뀌고 출품돼요."
              : "별자리 이름을 지어 주면 출품할 수 있어요. 같은 이름의 플레이리스트가 함께 만들어져요."
            : "출품하면 AI 가 잠시 뒤 채점해요. 회차당 작품 1개."}
      </Note>
    </div>
  );
}
