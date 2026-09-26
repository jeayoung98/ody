"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Button from "@/components/common/button";
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
import MatchResult from "./match-result";
import MyWorkView from "./my-work-view";
import SketchCanvas from "./sketch-canvas";
import SketchSteps from "./sketch-steps";
import SubmitForm from "./submit-form";
import TemplatePicker from "./template-picker";

/**
 * 별자리 그리기 (S15P21A405-602 · 598 · 640 · 693 · 702).
 *
 * **한 화면에 한 단계만** 크게 보인다 (702). 예전에는 단계가 진행될수록 결과·출품 폼이 아래로 이어 붙어 무엇을 할
 * 차례인지 흐렸다. 왼쪽은 세로 진행 바와 뒤로, 오른쪽은 지금 단계의 판 · 그 아래 설명 · 오른쪽 아래 다음 버튼이다.
 * 다음 버튼은 모든 단계에서 같은 자리에 선다 — 그리기는 "별 찾기", 곡 확인은 "다음", 이름 짓기는 "출품하기".
 *
 * - 그리기 → 다음: 그린 점으로 곡을 찾는다(`/api/artwork/draw`). 3개 미만이면 끄지 않고 안내만 한다
 * - AI 추천 모양을 고르면 바로 곡 확인으로 간다 (그 결과도 같은 `match` 자리에 들어온다)
 * - 뒤로 가도 그린 점은 남는다. 점을 고치면 찾은 곡만 버린다(스토어가 한다)
 * - 출품하면 AI 채점 단계(내 작품 화면)로 넘어간다. 채점은 서버가 뒤에서 한다
 * - 이미 낸 작품이 있고 그리던 게 없으면 채점 단계(내 작품)로 연다 — 새로 그리기는 교체된다고 먼저 말한다
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
  const { submit, pending: submitting, label: submitLabel } = useContestSubmit({ contest, match, my, loggedIn: !!me, onSubmitted: () => setStep("scoring") });

  /**
   * 처음 열 때 한 번만 고른다 — 낸 작품이 있고 그리다 만 것이 없으면 내 작품(채점) 화면으로 연다.
   * 내 작품 목록이 오기 전에 고르면 늘 그리기로 열리므로, 목록이 왔을 때(또는 비로그인) 정한다.
   */
  const decided = useRef(false);
  const mineReady = !me || mineQuery.isFetched;
  useEffect(() => {
    if (decided.current || !mineReady) return;
    decided.current = true;
    if (my && points.length === 0 && !match) setStep("scoring");
  }, [mineReady, my, points.length, match, setStep]);
  // 저장된 단계가 지금 상태와 안 맞으면(찾은 곡이 버려졌다·작품이 없다) 그리기로 보여 준다
  const current = visibleStep(step, { hasMine: my != null, hasMatch: match != null });

  const { minPoints, maxPoints } = SKETCH_RULES;
  const count = points.length;

  const handleAdd = (p: Parameters<typeof addPoint>[0]) => {
    if (count >= maxPoints) return toast(`점은 ${maxPoints}개까지 찍을 수 있어요`);
    addPoint(p);
  };

  /** 그리기의 다음 = 별 찾기. 이미 이 점으로 찾아 둔 결과가 있으면 다시 안 묻는다 */
  const findStars = () => {
    if (match) return setStep("review");
    if (count < minPoints) return toast(`점을 ${minPoints}개 이상 찍어 주세요 · 지금 ${count}개`);
    matchMut.mutate(points, {
      onSuccess: (m) => {
        setMatch(m);
        setStep("review");
      },
      onError: (e) => toast(e.message),
    });
  };

  const back = backStep(current);

  let body: ReactNode = null;
  let help: ReactNode = null;
  let action: ReactNode = null;
  if (current === "draw") {
    body = (
      <div className="relative mx-auto h-full max-h-full aspect-square">
        <SketchCanvas points={points} closed={closed} result={null} onAdd={handleAdd} onRemove={removePoint} />
        {/* 도구는 캔버스 위 상단에 — 살짝 어두운 판 위에 얹어 별밭과 갈린다 */}
        <div className="absolute inset-x-0 top-0 flex flex-wrap items-center gap-1.5 rounded-t-box-sm bg-void/55 px-2 py-1.5 backdrop-blur-[3px]">
          <Button size="sm" onClick={undo} disabled={!count}>
            한 점 되돌리기
          </Button>
          <Button size="sm" active={closed} onClick={toggleClosed} disabled={count < 3} title="마지막 점과 첫 점을 이어 닫힌 모양으로">
            마지막 → 첫 점 잇기
          </Button>
          <TemplatePicker loggedIn={!!me} theme={contest.theme} onPicked={() => setStep("review")} />
          <Button size="sm" variant="ghost" onClick={clear} disabled={!count && !match}>
            지우기
          </Button>
          <span className="num ml-auto text-xs text-ink-3">
            점 {count} / {maxPoints}
          </span>
        </div>
      </div>
    );
    help = (
      <>
        <b className="text-ink">{contest.theme}</b> 모양을 점으로 그려 보세요. 빈 곳을 누르면 점이 붙고, 찍힌 점을 다시 누르면 빠져요. 찍은 순서대로 이어지고 {minPoints}~{maxPoints}개까지 찍을 수 있어요.
        <br />
        다음을 누르면 그린 모양과 닮은 배치의 곡을 별밭에서 찾아 별자리로 이어 줘요. 막막하면 ✨ AI 추천 모양으로 시작해 보세요.
      </>
    );
    action = (
      <Button size="sm" variant="primary" disabled={matchMut.isPending} onClick={findStars}>
        {matchMut.isPending ? "별을 찾는 중..." : "다음 ›"}
      </Button>
    );
  } else if (current === "review" && match) {
    body = (
      <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5">
        <div className="flex min-h-0 items-center justify-center">
          <div className="aspect-square h-full max-h-full max-w-full">
            <SketchCanvas points={points} closed={closed} result={match.tracks} onAdd={() => {}} onRemove={() => {}} highlight={hovered} readOnly />
          </div>
        </div>
        <MatchResult match={match} className="min-h-0" onHover={setHovered} showNote={false} />
      </div>
    );
    help = match.template ? (
      <>
        AI 추천 「{match.template.label}」 모양대로 고른 곡이에요. 플레이리스트 「{match.template.playlistName}」은 이미 만들어졌고, 출품하면 다음 단계에서 지은 이름으로 바뀌어요.
      </>
    ) : (
      <>
        점을 찍은 순서대로 한 점에 한 곡씩 골랐어요 — 목록 번호가 왼쪽 별 번호예요. 출품하면 이 곡들로 플레이리스트가 만들어져요.
        {match.quality === "LOW" && " 그린 모양과 꽤 달라요. 뒤로 가서 점을 고쳐 다시 찾을 수 있어요 — 이대로 출품해도 돼요."}
      </>
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
          <SubmitForm contest={contest} match={match} my={my} onSubmit={submit} />
        </div>
      </div>
    );
    help = (
      <>
        지은 이름이 플레이리스트 이름이 돼요. 출품하면 <b className="text-ink">AI 가 잠시 뒤 채점</b>하고, 갤러리와 순위에 올라 좋아요를 받을 수 있어요. 회차당 작품은 1개예요.
        {!open && " 지금은 접수 기간이 아니에요."}
      </>
    );
    action = (
      <Button size="sm" variant="primary" disabled={submitting} onClick={submit}>
        {submitting ? "출품하는 중..." : `${submitLabel} ›`}
      </Button>
    );
  } else if (current === "scoring" && my) {
    // 안내는 판 아래가 아니라 카드 바로 밑에 카드 폭에 맞춰 붙인다 (S15P21A405-702)
    const note = my.status === "PENDING" ? "AI 가 별자리를 살펴보는 중이에요. 끝나면 이 화면에 바로 점수와 한 줄 평이 떠요." : "채점이 끝났어요. 갤러리와 순위에서 다른 별자리와 함께 볼 수 있어요.";
    body = <MyWorkView entry={my} contest={contest} onDrawNew={() => setStep("draw")} note={note} />;
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[170px_minmax(0,1fr)] gap-6">
      <aside className="flex flex-col gap-5 border-r border-line pr-4">
        <SketchSteps current={current === "scoring" && my?.status === "SCORED" ? null : current} />
      </aside>
      <section className="flex min-h-0 flex-col gap-3">
        {/* 채점 단계는 카드(그림 280px + 점수 + 한 줄 평)가 판보다 길 수 있어 넘치면 안에서 스크롤한다 */}
        <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto">{body}</div>
        {help && <p className="text-sm leading-relaxed text-ink-2">{help}</p>}
        <div className="flex min-h-9 items-center justify-between gap-3">
          {/* 이전 작품은 한 줄로만 — 채점 화면이 아니면 지금 그림의 점수처럼 보이면 안 된다 */}
          <span className="min-w-0 truncate text-xs text-ink-3">
            {my && current !== "scoring" && (
              <>
                현재 출품작 「{my.title}」{my.status === "SCORED" && my.score != null ? ` · AI ${my.score}점` : my.status === "PENDING" ? " · 채점 중" : ""} — 새로 내면 교체돼요
              </>
            )}
          </span>
          {/* 뒤로는 다음 바로 왼쪽 — 두 버튼이 한 자리에 모여 있어야 손이 오간다. 돌아갈 곳이 없으면 안 보인다 */}
          <div className="flex shrink-0 items-center gap-2">
            {back && (
              <Button size="sm" variant="ghost" onClick={() => setStep(back)}>
                <ChevronLeftIcon /> 뒤로
              </Button>
            )}
            {action}
          </div>
        </div>
      </section>
    </div>
  );
}
