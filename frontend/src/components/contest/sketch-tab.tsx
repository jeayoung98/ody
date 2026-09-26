"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Button from "@/components/common/button";
import GuardedButton from "@/components/common/guarded-button";
import { ChevronLeftIcon } from "@/components/common/icons";
import { CONTEST_ARTWORK_THUMB_PX, SKETCH_RULES } from "@/constants";
import { useContestMatchMutation } from "@/hooks/mutations/use-contest-match-mutation";
import { useContestMineQuery } from "@/hooks/queries/use-contest-mine-query";
import { useMeQuery } from "@/hooks/queries/use-me-query";
import { useContestSubmit } from "@/hooks/use-contest-submit";
import { backStep, myEntry, roundPhase, visibleStep } from "@/lib/contest-view";
import { useContestStore } from "@/stores/use-contest-store";
import { useToastStore } from "@/stores/use-toast-store";
import type { Contest } from "@/types";
import ConstellationThumb from "./constellation-thumb";
import DrawNewButton from "./draw-new-button";
import MatchResult from "./match-result";
import MyWorkView from "./my-work-view";
import SketchCanvas from "./sketch-canvas";
import SketchSteps from "./sketch-steps";
import SubmitForm from "./submit-form";
import TemplatePicker from "./template-picker";

/**
 * 별자리 그리기 (S15P21A405-602 · 598 · 640 · 693 · 702).
 *
 * **한 화면에 한 단계만** 크게 보인다 (702). 왼쪽은 세로 진행 바, 오른쪽은 지금 단계의 판, 그 아래 버튼 줄이다.
 * 버튼 줄 오른쪽 끝에 늘 다음 동작이 서고(뒤로는 그 바로 왼쪽), 못 누를 때는 꺼진 채 눌러 보면 까닭을 토스트로 말한다.
 *
 * - 그리기: 도구는 캔버스 **밖 위**(AI 추천 모양 · 한 점 되돌리기 · 전체 지우기), 설명은 캔버스 오른쪽. 첫 점을 누르면
 *   마지막 점과 이어 닫힌다(잇기 버튼 없음). 다음 = 별 찾기
 * - 곡 확인: 읽기 전용 캔버스 밑에 안내를 붙이고 오른쪽에 곡 목록
 * - 이름·출품: 미리보기 + 이름. 이름이 없으면 출품 버튼이 꺼진다
 * - AI 채점 → 채점이 끝나면 저절로 완성으로 넘어간다. 두 단계 모두 오른쪽 아래가 "새로 그리기"
 * - 뒤로 가도 그린 점은 남고, 점을 고치면 찾은 곡만 버린다(스토어가 한다)
 */
export default function SketchTab({ contest }: { contest: Contest }) {
  const points = useContestStore((s) => s.points);
  const closed = useContestStore((s) => s.closed);
  const match = useContestStore((s) => s.match);
  const step = useContestStore((s) => s.step);
  const setStep = useContestStore((s) => s.setStep);
  const addPoint = useContestStore((s) => s.addPoint);
  const removePoint = useContestStore((s) => s.removePoint);
  const undo = useContestStore((s) => s.undo);
  const clear = useContestStore((s) => s.clear);
  const toggleClosed = useContestStore((s) => s.toggleClosed);
  const setMatch = useContestStore((s) => s.setMatch);
  const toast = useToastStore((s) => s.show);
  const matchMut = useContestMatchMutation();
  const { data: me } = useMeQuery();
  const mineQuery = useContestMineQuery(!!me);
  const my = myEntry(mineQuery.data);
  const open = roundPhase(contest) === "OPEN";
  /** 곡 목록에서 가리키는 순번 — 캔버스가 그 별에 고리를 두른다 */
  const [hovered, setHovered] = useState<number | null>(null);
  const submitter = useContestSubmit({ contest, match, my, loggedIn: !!me, onSubmitted: () => setStep("scoring") });

  /**
   * 처음 열 때 한 번만 고른다 — 낸 작품이 있고 그리다 만 것이 없으면 내 작품(채점·완성) 화면으로 연다.
   * 내 작품 목록이 오기 전에 고르면 늘 그리기로 열리므로, 목록이 왔을 때(또는 비로그인) 정한다.
   */
  const decided = useRef(false);
  const mineReady = !me || mineQuery.isFetched;
  useEffect(() => {
    if (decided.current || !mineReady) return;
    decided.current = true;
    if (my && points.length === 0 && !match) setStep("scoring");
  }, [mineReady, my, points.length, match, setStep]);
  // 저장된 단계가 지금 상태와 안 맞으면(찾은 곡이 버려졌다·작품이 없다) 고쳐 보여 주고, 채점이 끝나면 완성으로
  const current = visibleStep(step, { hasMine: my != null, hasMatch: match != null, mineScored: my?.status === "SCORED" });
  const back = backStep(current);

  const { minPoints, maxPoints } = SKETCH_RULES;
  const count = points.length;

  const handleAdd = (p: Parameters<typeof addPoint>[0]) => {
    if (count >= maxPoints) return toast(`점은 ${maxPoints}개까지 찍을 수 있어요`);
    addPoint(p);
  };

  /** 그리기의 다음 = 별 찾기. 이미 이 점으로 찾아 둔 결과가 있으면 다시 안 묻는다 */
  const findStars = () => {
    if (match) return setStep("review");
    matchMut.mutate(points, {
      onSuccess: (m) => {
        setMatch(m);
        setStep("review");
      },
      onError: (e) => toast(e.message),
    });
  };

  /** 현재 출품작 한 줄 — 새로 그리는 동안 이전 작품이 교체된다는 것만 알린다 (곡 확인 단계에만) */
  const currentEntryLine = my ? (
    <p className="text-xs text-ink-3">
      현재 출품작 「{my.title}」{my.status === "SCORED" && my.score != null ? ` · AI ${my.score}점` : my.status === "PENDING" ? " · 채점 중" : ""} — 새로 내면 교체돼요
    </p>
  ) : null;

  let body: ReactNode = null;
  let action: ReactNode = null;
  if (current === "draw") {
    body = (
      <div className="flex h-full min-h-0 flex-col gap-2">
        {/* 도구는 캔버스 밖 위 — 캔버스 위에 얹으면 점 찍을 자리를 가린다 (702) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <TemplatePicker loggedIn={!!me} theme={contest.theme} onPicked={() => setStep("review")} />
          <Button size="sm" onClick={undo} disabled={!count}>
            한 점 되돌리기
          </Button>
          <Button size="sm" variant="ghost" onClick={clear} disabled={!count && !match}>
            전체 지우기
          </Button>
          <span className="num ml-auto text-xs text-ink-3">
            점 {count} / {maxPoints}
          </span>
        </div>
        <div className="flex min-h-0 flex-1 gap-5">
          {/* 캔버스는 남은 높이만큼 크게 — 정사각형이다 */}
          <div className="aspect-square h-full max-h-full min-h-0 shrink-0">
            <SketchCanvas points={points} closed={closed} result={null} onAdd={handleAdd} onRemove={removePoint} onToggleClose={toggleClosed} />
          </div>
          <div className="flex min-w-0 flex-col gap-3 pt-1 text-sm leading-relaxed text-ink-2">
            <p className="text-base text-ink">
              <b>{contest.theme}</b> 모양을 점으로 그려 보세요
            </p>
            <p>빈 곳을 누르면 점이 붙고, 찍힌 점을 다시 누르면 빠져요. 찍은 순서대로 이어지고 {minPoints}~{maxPoints}개까지 찍을 수 있어요.</p>
            <p>첫 점을 다시 누르면 마지막 점과 이어져 닫힌 모양이 돼요.</p>
            <p>다음을 누르면 그린 모양과 닮은 배치의 곡을 별밭에서 찾아 별자리로 이어 줘요. 막막하면 ✨ AI 추천 모양으로 시작해 보세요.</p>
          </div>
        </div>
      </div>
    );
    action = (
      <GuardedButton size="sm" variant="primary" blocked={!match && count < minPoints ? `점을 ${minPoints}개 이상 찍어 주세요 · 지금 ${count}개` : null} disabled={matchMut.isPending} onClick={findStars}>
        {matchMut.isPending ? "별을 찾는 중..." : "다음 ›"}
      </GuardedButton>
    );
  } else if (current === "review" && match) {
    body = (
      <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5">
        <div className="flex min-h-0 flex-col gap-2">
          <div className="min-h-0 flex-1">
            <div className="mx-auto aspect-square h-full max-h-full max-w-full">
              <SketchCanvas points={points} closed={closed} result={match.tracks} onAdd={() => {}} onRemove={() => {}} highlight={hovered} readOnly />
            </div>
          </div>
          {/* 안내는 캔버스 바로 밑에 붙인다 (702) — 캔버스의 번호를 설명하는 말이라 캔버스 곁에 있어야 읽힌다 */}
          <p className="text-sm leading-relaxed text-ink-2">
            {match.template
              ? `AI 추천 「${match.template.label}」 모양대로 고른 곡이에요. 플레이리스트 「${match.template.playlistName}」은 이미 만들어졌고, 출품하면 다음 단계에서 지은 이름으로 바뀌어요.`
              : "점을 찍은 순서대로 한 점에 한 곡씩 골랐어요 — 목록 번호가 별 번호예요. 출품하면 이 곡들로 플레이리스트가 만들어져요."}
            {!match.template && match.quality === "LOW" && " 그린 모양과 꽤 달라요. 뒤로 가서 점을 고쳐 다시 찾을 수 있어요."}
          </p>
          {currentEntryLine}
        </div>
        <MatchResult match={match} className="min-h-0" onHover={setHovered} showNote={false} />
      </div>
    );
    action = (
      <Button size="sm" variant="primary" onClick={() => setStep("submit")}>
        다음 ›
      </Button>
    );
  } else if (current === "submit" && match) {
    body = (
      <div className="mx-auto flex h-full w-full max-w-md flex-col items-center justify-center gap-5">
        <ConstellationThumb tracks={match.tracks} closed={closed} size={CONTEST_ARTWORK_THUMB_PX} className="border border-line" />
        <div className="w-full">
          <SubmitForm contest={contest} match={match} my={my} onSubmit={submitter.submit} />
        </div>
      </div>
    );
    action = (
      <GuardedButton size="sm" variant="primary" blocked={submitter.blocked} disabled={submitter.pending} onClick={submitter.submit}>
        {submitter.pending ? "출품하는 중..." : `${submitter.label} ›`}
      </GuardedButton>
    );
  } else if ((current === "scoring" || current === "done") && my) {
    // 채점 중 문구는 카드가 이미 말한다 — 밑에 또 적지 않는다. 완성이면 결과 뒤에 갈 곳만 한 줄
    body = <MyWorkView entry={my} contest={contest} note={current === "done" ? "채점이 끝났어요. 갤러리와 순위에서 다른 별자리와 함께 볼 수 있어요." : null} />;
    if (open) action = <DrawNewButton entry={my} onConfirm={() => setStep("draw")} />;
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[150px_minmax(0,1fr)] gap-6">
      <aside className="border-r border-line pr-4">
        <SketchSteps current={current} />
      </aside>
      <section className="flex min-h-0 flex-col gap-3">
        {/* 채점·완성은 카드(그림 + 점수 + 한 줄 평)가 판보다 길 수 있어 넘치면 안에서 스크롤한다 */}
        <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto">{body}</div>
        {/* 버튼 줄 — 뒤로는 다음 바로 왼쪽. 돌아갈 곳이 없으면 안 보인다 */}
        <div className="flex min-h-9 items-center justify-end gap-2">
          {back && (
            <Button size="sm" variant="ghost" onClick={() => setStep(back)}>
              <ChevronLeftIcon /> 뒤로
            </Button>
          )}
          {action}
        </div>
      </section>
    </div>
  );
}
