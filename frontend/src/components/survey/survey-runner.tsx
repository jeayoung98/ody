"use client";

import { useEffect, useMemo } from "react";
import { GENRE_NAMES } from "@/constants/map";
import { useJourneyRouteQuery } from "@/hooks/queries/use-journey-route-query";
import { useNearbyQuery } from "@/hooks/queries/use-nearby-query";
import { useVideoIdQuery } from "@/hooks/queries/use-video-id-query";
import { useJourneyEdges, useNearbyEdges } from "@/hooks/survey/use-survey-edges";
import { sendUnanswered, useLoadAnswered } from "@/hooks/survey/use-survey-submit";
import { useBlockingStore } from "@/stores/use-blocking-store";
import { useMapStore } from "@/stores/use-map-store";
import { usePlayerStore } from "@/stores/use-player-store";
import { useSurveyStore } from "@/stores/use-survey-store";
import { useTutorialStore } from "@/stores/use-tutorial-store";
import { logSurveyGate } from "@/hooks/survey/survey-log";
import SurveyCard from "./survey-card";
import type { MapPoint } from "@/types/map";

/** 이웃 한 곡에서 카드가 쓸 것만 뽑는다. `neighbors` 에는 곡 길이가 없다 (BACKEND-NOTES A-22) */
function toTrack(p: MapPoint) {
  return { musicId: p.musicId, title: p.title, artist: p.artist, genreId: p.genreId };
}

/** 장르 이름 → ID. 이름표에 없으면 색을 고르지 않는다(중립색) */
function indexOfGenre(name: string): number | null {
  const i = GENRE_NAMES.indexOf(name as (typeof GENRE_NAMES)[number]);
  return i < 0 ? null : i;
}

/**
 * 설문 본체 (S15P21A405-294 · 335).
 *
 * `SurveyGate` 가 **동적으로 불러온다** — 플래그가 꺼진 빌드에서는 이 모듈이 아예 로드되지
 * 않는다. 그래서 설문 관련 import(스토어·훅·카드)가 전부 이 경계 안에 있어야 한다.
 *
 * 의존은 한 방향이다 — 설문이 기존 스토어·쿼리를 **읽기만** 한다. 기존 코드가 설문에 대해
 * 아는 것은 `use-blocking-store` 의 자리 하나뿐이고, 거기 꽂힌 것이 무엇인지는 모른다.
 *
 * ## 하는 일 넷
 *
 * 1. 밟은 자취를 남긴다 — 어떤 곡이 소리가 났고 어떤 곡이 못 들려준 곡인가
 * 2. 지금 곡을 떠날 때 물을 간선을 정해 둔다 (`pending`)
 * 3. 곡을 바꾸려는 쪽 앞에 끼어들 함수를 꽂는다 (`gate`)
 * 4. 답 없이 페이지를 떠나면 무응답 행을 보낸다
 *
 * **최종 배포 때 걷어낼 기능이다.**
 */
export default function SurveyRunner() {
  const currentMusicId = usePlayerStore((s) => s.currentMusicId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const context = usePlayerStore((s) => s.context);
  const viewMode = useMapStore((s) => s.viewMode);
  const nearbyCenterMusicId = useMapStore((s) => s.nearbyCenterMusicId);
  /**
   * **튜토리얼 중에는 아무것도 하지 않는다** (S15P21A405-335 결정 8).
   *
   * 단계가 별 고르기 → 주변 탐색 → 여정이라 튜토리얼이 직접 곡을 틀고 탐색을 켠다. 그대로 두면
   * 스포트라이트 위로 설문 모달이 덮여 다음에 뭘 눌러야 할지가 안 보이고, 익히는 중에 찍은
   * 답이 집계에 섞인다.
   */
  const tutorialDone = useTutorialStore((s) => s.isDone);

  const enter = useSurveyStore((s) => s.enter);
  const setPending = useSurveyStore((s) => s.setPending);
  const markPlayed = useSurveyStore((s) => s.markPlayed);
  const markUnplayable = useSurveyStore((s) => s.markUnplayable);
  const setGate = useBlockingStore((s) => s.setGate);

  useLoadAnswered();

  /**
   * 들려줄 수 있는 곡인가 — **`videoId` 하나로 판단한다** (S15P21A405-326).
   *
   * 한 곡씩만 묻는다. 그 조회는 DB 에 없으면 외부 API 를 불러 채우는 동작이라 미리 여러 곡을
   * 칠 수 없다 (S15P21A405-340). 그래서 **앞으로 나올 역이 재생 가능한지는 알 수 없고**,
   * 간선 판정도 그것을 필요로 하지 않는다 — 지나온 곡만 보면 되기 때문이다.
   */
  const video = useVideoIdQuery(currentMusicId);
  const videoId = video.data?.videoId;

  /**
   * 같은 탐색 결과를 설문도 읽는다. 화면이 이미 받아 둔 캐시라 새 요청이 나가지 않는다
   * (`staleTime` 안이면 TanStack Query 가 같은 데이터를 돌려준다).
   */
  const nearby = useNearbyQuery(viewMode === "nearby" ? nearbyCenterMusicId : null);
  const inJourney = context.kind === "journey";
  const journey = useJourneyRouteQuery(
    inJourney ? context.startMusicId : null,
    inJourney ? context.endMusicId : null,
    inJourney,
  );

  /** 이웃 응답(`MapPoint`)은 장르 ID 를 그대로 준다 */
  const nearbyEdge = useNearbyEdges(
    useMemo(() => (nearby.data ? toTrack(nearby.data.center) : undefined), [nearby.data]),
    useMemo(() => nearby.data?.neighbors.map(toTrack), [nearby.data]),
  );
  /** 정거장은 장르를 이름으로 준다 — 색을 고르려면 ID 가 필요해서 이름표에서 되찾는다 */
  const journeyEdge = useJourneyEdges(
    useMemo(
      () =>
        journey.data?.stops.map((s) => ({
          musicId: s.id,
          title: s.title,
          artist: s.artist,
          genreId: s.genreName == null ? null : indexOfGenre(s.genreName),
          durationSec: s.duration,
        })),
      [journey.data],
    ),
  );

  /**
   * 어느 탐색이 이 재생을 이끌고 있나. **한 곡이 여정의 역이면서 주변의 이웃일 수 있어서**
   * 우선순위를 정해 둔다 — 재생 컨텍스트가 먼저고, 그게 단독이면 지도 뷰를 본다.
   *
   * 주변 표는 **단일 재생이거나 주변 10곡 순차 재생일 때만** 본다. `viewMode` 는 지도 오버레이
   * 상태라 플리를 틀어도 안 꺼지고 (`playQueue` 는 `viewMode` 를 건드리지 않는다), 뷰를 켜 둔 채
   * 플리를 돌리면 그 곡이 마침 이웃 목록에 있을 때 주탐 행으로 들어간다. **플리는 사용자가 임의로
   * 담은 목록이라 우리 추천 결과가 아니다** — 재려는 건 주변 탐색·경로 탐색이 고른 연결이 사람
   * 귀에도 맞느냐지 남이 만든 목록의 흐름이 아니다.
   *
   * `nearby` 는 **우리가 고른 10곡을 그대로 순서대로 트는 것**이라 단일 재생과 같은 자격이다
   * (S15P21A405-359).
   */
  const inNearby = viewMode === "nearby" && (context.kind === "single" || context.kind === "nearby");

  /**
   * **시계 하나, effect 하나.** 방문을 여는 것과 재생 시간을 재는 것을 갈라 두면 두 effect 의
   * 실행 순서에 정답이 생기고, 그 불변식이 주석에만 걸려 있게 된다 — 뒤집히면 이전 곡의 방문에
   * 시계를 켠다. 스토어가 곡을 보고 알아서 가른다.
   */
  useEffect(() => {
    enter(currentMusicId, isPlaying, Date.now());
  }, [currentMusicId, isPlaying, enter]);

  /**
   * 밟은 자취. **소리가 났는가로 가른다** — 새로고침 복원(`restoreLast`)은 곡만 되살리고
   * 재생하지 않으므로 `isPlaying` 이 false 라 자취에 안 남는다. 들은 적 없는 곡을 비교 상대로
   * 삼지 않기 위한 조건이다.
   */
  useEffect(() => {
    if (currentMusicId == null || videoId === undefined) return;
    if (videoId == null) markUnplayable(currentMusicId);
    else if (isPlaying) markPlayed(currentMusicId);
  }, [currentMusicId, videoId, isPlaying, markPlayed, markUnplayable]);

  /**
   * 지금 곡을 떠날 때 물을 간선을 잡아 둔다.
   *
   * 자취(`played`·`lastPlayed`·`unplayable`)는 **스토어에서 그때그때 읽는다.** 구독하면
   * 이 곡을 `markPlayed` 한 순간 `lastPlayed` 가 자기 자신이 되어 방금 잡은 간선을 스스로
   * 무너뜨린다. 자취가 바뀌었다고 다시 풀 이유도 없다 — 간선은 들어온 순간에 정해진다.
   */
  useEffect(() => {
    if (currentMusicId == null) return;
    const trail = useSurveyStore.getState();
    const resolve = !tutorialDone ? null : inJourney ? journeyEdge : inNearby ? nearbyEdge : null;
    const edge = resolve?.(currentMusicId, trail) ?? null;
    const alreadyAnswered = edge != null && trail.hasAnswered(edge.target);
    // 안 뜨는 것이 정상인지 고장인지 콘솔에서 짚을 수 있게 한다 (S15P21A405-368)
    logSurveyGate({ musicId: currentMusicId, tutorialDone, inJourney, inNearby, edge, alreadyAnswered, trail });
    if (!tutorialDone || alreadyAnswered) return;
    setPending(edge);
  }, [tutorialDone, currentMusicId, inJourney, inNearby, journeyEdge, nearbyEdge, setPending, videoId]);

  /**
   * 곡을 바꾸려는 쪽 앞에 끼어들 함수를 꽂는다.
   *
   * 재생 코드는 이게 설문인 줄 모르고 `heldBack()` 한 줄만 부른다. 튜토리얼 중이거나 설문을
   * 지우면 꽂힌 것이 없어 전부 그냥 지나간다.
   */
  useEffect(() => {
    if (!tutorialDone) return;
    setGate(useSurveyStore.getState().gate);
    return () => setGate(null);
  }, [tutorialDone, setGate]);

  /**
   * 답 없이 페이지를 떠나면 행만 남긴다 (`verdict = null`).
   *
   * 청취 시간 조건이 사라진 뒤로 이 길은 하나뿐이다 — 곡을 바꾸는 다른 모든 길은 위 `gate` 가
   * 붙잡아 물어보기 때문이다. 카드가 떴든 아직 안 떴든 밟은 간선이 남아 있으면 보낸다.
   */
  useEffect(() => {
    const onLeave = () => {
      const s = useSurveyStore.getState();
      const edge = s.prompt ?? s.pending;
      if (!edge) return;
      sendUnanswered({
        target: edge.target,
        listenedMs: s.stintMs(edge.target.musicId),
        skipped: false,
        durationSec: edge.subject.durationSec,
      });
      s.setPending(null);
    };
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, []);

  return <SurveyCard />;
}
