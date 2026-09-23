"use client";

import Button from "@/components/common/button";
import Divider from "@/components/common/divider";
import Note from "@/components/common/note";
import { useContestJudgeMutation } from "@/hooks/mutations/use-contest-judge-mutation";
import { useContestMatchMutation } from "@/hooks/mutations/use-contest-match-mutation";
import { useContestStore } from "@/stores/use-contest-store";
import { useToastStore } from "@/stores/use-toast-store";
import type { Contest } from "@/types";
import JudgeCard from "./judge-card";
import MatchResult from "./match-result";
import SketchCanvas from "./sketch-canvas";
import SubmitForm from "./submit-form";

/**
 * 별자리 그리기 (S15P21A405-602 · 598).
 *
 * 흐름: 점 찍기 → **별 찾기**(매칭) → 결과가 오면 **바로 심사** → 이름 짓고 그 점수로 출품.
 * 점을 건드리면 결과·점수가 사라진다 — 다른 모양에 붙은 점수가 남아 있으면 안 된다.
 */
export default function SketchTab({ contest }: { contest: Contest }) {
  const points = useContestStore((s) => s.points);
  const closed = useContestStore((s) => s.closed);
  const match = useContestStore((s) => s.match);
  const judge = useContestStore((s) => s.judge);
  const addPoint = useContestStore((s) => s.addPoint);
  const removePoint = useContestStore((s) => s.removePoint);
  const undo = useContestStore((s) => s.undo);
  const clear = useContestStore((s) => s.clear);
  const toggleClosed = useContestStore((s) => s.toggleClosed);
  const setMatch = useContestStore((s) => s.setMatch);
  const setJudge = useContestStore((s) => s.setJudge);
  const toast = useToastStore((s) => s.show);
  const matchMut = useContestMatchMutation();
  const judgeMut = useContestJudgeMutation();

  const { minPoints, maxPoints, aiGate } = contest.rules;
  const count = points.length;
  const canMatch = count >= minPoints && count <= maxPoints;
  const open = contest.status === "OPEN";

  const findStars = () => {
    if (!canMatch) return;
    matchMut.mutate(
      { contestId: contest.id, points },
      {
        onSuccess: (m) => {
          setMatch(m);
          judgeMut.mutate(
            { contestId: contest.id, tracks: m.tracks, closed },
            { onSuccess: setJudge, onError: () => toast("심사에 실패했어요. 별을 다시 찾아 보세요") },
          );
        },
        onError: (e) => toast(e.message),
      },
    );
  };

  const handleAdd = (p: Parameters<typeof addPoint>[0]) => {
    if (count >= maxPoints) {
      toast(`점은 ${maxPoints}개까지 찍을 수 있어요`);
      return;
    }
    addPoint(p);
  };

  return (
    <div className="flex flex-col gap-3">
      <SketchCanvas points={points} closed={closed} result={match?.tracks ?? null} onAdd={handleAdd} onRemove={removePoint} />
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" onClick={undo} disabled={!count}>
          한 점 되돌리기
        </Button>
        <Button size="sm" active={closed} onClick={toggleClosed} disabled={count < 3} title="마지막 점과 첫 점을 이어 닫힌 모양으로">
          마지막 → 첫 점 잇기
        </Button>
        <Button size="sm" variant="ghost" onClick={clear} disabled={!count}>
          지우기
        </Button>
      </div>
      <Note>
        {match
          ? "점을 더 찍거나 빼면 결과가 지워지고 다시 찾아요."
          : `점 <b>${count}</b> / ${maxPoints} · 빈 곳을 누르면 점이 붙고, 찍힌 점을 다시 누르면 빠져요. ${minPoints}개 이상이면 별을 찾을 수 있어요.`
              .split(/(<b>.*?<\/b>)/)
              .map((part, i) => (part.startsWith("<b>") ? <b key={i}>{part.slice(3, -4)}</b> : part))}
      </Note>
      <Button variant="primary" className="w-full" disabled={!canMatch || !open || matchMut.isPending} onClick={findStars}>
        {matchMut.isPending ? "별을 찾는 중..." : !open ? "접수가 끝났어요" : match ? "이 모양으로 다시 찾기" : "이 모양으로 별 찾기"}
      </Button>

      {match && (
        <>
          <Divider />
          <MatchResult match={match} />
          <JudgeCard judge={judge} pending={judgeMut.isPending} aiGate={aiGate} theme={contest.theme} />
          <SubmitForm contest={contest} match={match} judge={judge} />
        </>
      )}
    </div>
  );
}
