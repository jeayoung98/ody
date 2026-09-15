"use client";

import { useEffect, useMemo, useRef } from "react";
import { SURVEY_MIN_LISTEN_MS } from "@/constants/survey";
import { useJourneyRouteQuery } from "@/hooks/queries/use-journey-route-query";
import { useNearbyQuery } from "@/hooks/queries/use-nearby-query";
import { sendUnanswered } from "@/hooks/survey/use-survey-submit";
import { useJourneyTargets, useNearbyTargets } from "@/hooks/survey/use-survey-targets";
import { SURVEY_FORCED, useSurveyTrigger } from "@/hooks/survey/use-survey-trigger";
import { useMapStore } from "@/stores/use-map-store";
import { usePlayerStore } from "@/stores/use-player-store";
import { useSurveyStore } from "@/stores/use-survey-store";
import SurveyCard from "./survey-card";
import { GENRE_NAMES } from "@/constants/map";
import type { MapPoint } from "@/types/map";

/** 이웃 한 곡에서 카드가 쓸 것만 뽑는다. 커버는 아직 응답에 없어서 비어 있다 */
function toTrack(p: MapPoint) {
  return { musicId: p.musicId, title: p.title, artist: p.artist, genreId: p.genreId };
}

/** 장르 이름 → ID. 이름표에 없으면 색을 고르지 않는다(중립색) */
function indexOfGenre(name: string): number | null {
  const i = GENRE_NAMES.indexOf(name as (typeof GENRE_NAMES)[number]);
  return i < 0 ? null : i;
}

/**
 * 설문 본체 (S15P21A405-294).
 *
 * `SurveyGate` 가 **동적으로 불러온다** — 플래그가 꺼진 빌드에서는 이 모듈이 아예 로드되지
 * 않는다. 그래서 설문 관련 import(스토어·훅·카드)가 전부 이 경계 안에 있어야 한다.
 *
 * 의존은 한 방향이다 — 설문이 기존 스토어·쿼리를 **읽기만** 한다. 기존 코드는 설문을 모른다.
 *
 * **최종 배포 때 걷어낼 기능이다.**
 */
export default function SurveyRunner() {
  const currentMusicId = usePlayerStore((s) => s.currentMusicId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const context = usePlayerStore((s) => s.context);
  const viewMode = useMapStore((s) => s.viewMode);
  const nearbyCenterMusicId = useMapStore((s) => s.nearbyCenterMusicId);

  const beginVisit = useSurveyStore((s) => s.beginVisit);
  const endVisit = useSurveyStore((s) => s.endVisit);
  const setPlaying = useSurveyStore((s) => s.setPlaying);
  const stintMs = useSurveyStore((s) => s.stintMs);
  const markSent = useSurveyStore((s) => s.markSent);
  const hasSent = useSurveyStore((s) => s.hasSent);

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
  const nearbyTargets = useNearbyTargets(
    useMemo(() => (nearby.data ? toTrack(nearby.data.center) : undefined), [nearby.data]),
    useMemo(() => nearby.data?.neighbors.map(toTrack), [nearby.data]),
  );
  /** 정거장은 장르를 이름으로 준다 — 색을 고르려면 ID 가 필요해서 이름표에서 되찾는다 */
  const journeyTargets = useJourneyTargets(
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
   * 지금 듣는 곡이 평가 대상인가. 경로 재생 중이면 경로 표, 주변 탐색 중이면 주변 표에서 찾는다.
   *
   * 주변 표는 **단일 재생이거나 주변 10곡 순차 재생일 때만** 본다. `viewMode` 는 지도 오버레이
   * 상태라 플리를 틀어도 안 꺼지고 (`playQueue` 는 `viewMode` 를 건드리지 않는다), 뷰를 켜 둔 채
   * 플리를 돌리면 그 곡이 마침 이웃 목록에 있을 때 주탐 행으로 들어간다. **플리는 사용자가 임의로
   * 담은 목록이라 우리 추천 결과가 아니다** — 재려는 건 주변 탐색·경로 탐색이 고른 연결이 사람
   * 귀에도 맞느냐지 남이 만든 목록의 흐름이 아니다. 경로 재생은 바로 위에서 갈라지므로 여기
   * 걸리는 건 플리뿐이다.
   *
   * `nearby` 는 **우리가 고른 10곡을 그대로 순서대로 트는 것**이라 단일 재생과 같은 자격이다
   * (S15P21A405-359). 이 줄에서 빠지면 순차 재생으로 들은 곡은 설문을 못 받는다.
   */
  const inNearby = viewMode === "nearby" && (context.kind === "single" || context.kind === "nearby");
  const table = inJourney ? journeyTargets : inNearby ? nearbyTargets : null;
  const prompt = currentMusicId != null && table ? (table.get(currentMusicId) ?? null) : null;

  /**
   * 떠나는 순간의 평가 대상을 붙들어 둔다.
   *
   * 아래 effect 는 **곡이 실제로 바뀔 때만** 돌아야 하는데(그래야 "넘겼다"가 참이다), 그러면
   * 그 안의 `prompt` 는 곡을 틀던 시점 값에 묶인다. 목록이 나중에 도착해 평가 대상이 된 곡을
   * 놓치므로, 대상은 ref 로 따로 최신값을 본다.
   */
  const promptRef = useRef<typeof prompt>(null);
  useEffect(() => {
    promptRef.current = prompt;
  }, [prompt]);

  /**
   * 곡별 청취 시간을 장부에 쌓고, **20초를 못 채우고 떠난 곡은 무응답 행으로 보낸다.**
   *
   * 의존은 `currentMusicId` **하나뿐이다.** 여기에 세션·순번을 넣으면, 곡은 그대로인데 이웃
   * 목록만 갈린 순간(다른 별로 건너가기)에도 cleanup 이 돌아 **재생 중인 곡을 "넘겼다"고**
   * 기록해 보낸다. 실제로 그랬다.
   *
   * 스킵한 곡을 통째로 빼면 정밀도가 실제보다 좋게 나온다 — 짧게 듣고 넘긴 곡이야말로
   * 추천이 틀렸을 가능성이 높기 때문이다. 그래서 묻지 않고 행만 남긴다.
   */
  useEffect(() => {
    if (currentMusicId == null) return;
    // 카드가 재생 도중에 뜬다 — 그때 "지금까지 몇 초"를 알려면 방문이 스토어에 열려 있어야 한다
    beginVisit(currentMusicId);

    // 탭 숨김(pagehide)과 곡 바뀜(cleanup)이 잇따라 오면 장부에 같은 시간이 두 번 들어간다
    let settled = false;
    const settle = (skipped: boolean) => {
      if (settled) return;
      settled = true;
      const listenedMs = stintMs(currentMusicId); // 마감 전에 읽는다 — 이번 체류가 포함돼야 한다
      endVisit();

      const leaving = promptRef.current;
      if (!leaving || hasSent(leaving.target)) return;
      // 20초를 넘겼으면 설문이 떴거나 뜰 조건이었다 — 그건 카드가 제출로 처리한다
      if (!SURVEY_FORCED && listenedMs >= SURVEY_MIN_LISTEN_MS) return;
      // 무응답 행의 `prevMusicId` 는 경로가 정한 앞 역 그대로다 — 비교 상대를 고를 일이 없다
      sendUnanswered({ target: leaving.target, listenedMs, skipped, durationSec: leaving.subject.durationSec });
      markSent(leaving.target);
    };

    // 탭을 닫거나 숨기면 곡이 바뀌지 않는다 — 그 자리에서 정리해 보낸다
    const onLeave = () => settle(false);
    window.addEventListener("pagehide", onLeave);

    return () => {
      window.removeEventListener("pagehide", onLeave);
      settle(true); // 곡이 바뀐 것은 사용자가 넘긴 것으로 본다
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMusicId]);

  /**
   * **재생 중일 때만 시계가 돈다** (S15P21A405-308 임베드 이후).
   *
   * `videoId` 가 채워지면서 임베드 플레이어가 실제로 소리를 낸다. 유튜브 쪽에서 멈추면
   * `isPlaying` 이 따라 내려오므로, 청취 시간이 "현재 곡으로 머문 시간" 이 아니라
   * **실제로 재생된 시간**이 된다. 카드를 띄워둔 채 멈춰두면 더 안 쌓인다.
   *
   * 곡 바꾸기 effect **아래에 둔다.** 곡이 바뀌면 위에서 새 방문을 연 뒤 여기서 시계를
   * 켜야 한다 — 순서가 바뀌면 이전 곡의 방문에 시계를 켠다.
   */
  useEffect(() => {
    if (currentMusicId == null) return;
    setPlaying(isPlaying, Date.now());
  }, [currentMusicId, isPlaying, setPlaying]);

  useSurveyTrigger(prompt, isPlaying);

  return <SurveyCard />;
}
