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
  const context = usePlayerStore((s) => s.context);
  const viewMode = useMapStore((s) => s.viewMode);
  const nearbyCenterMusicId = useMapStore((s) => s.nearbyCenterMusicId);

  const beginListening = useSurveyStore((s) => s.beginListening);
  const noteListened = useSurveyStore((s) => s.noteListened);
  const elapsedMs = useSurveyStore((s) => s.elapsedMs);
  const resolve = useSurveyStore((s) => s.resolve);
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

  /** 지금 듣는 곡이 평가 대상인가. 경로 재생 중이면 경로 표, 주변 탐색 중이면 주변 표에서 찾는다 */
  const table = inJourney ? journeyTargets : viewMode === "nearby" ? nearbyTargets : null;
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
    const from = Date.now();
    // 카드가 재생 도중에 뜬다 — 그때 "지금까지 몇 초"를 알려면 시작 시각이 스토어에 있어야 한다
    beginListening(currentMusicId, from);

    // 탭 숨김(pagehide)과 곡 바뀜(cleanup)이 잇따라 오면 장부에 같은 시간이 두 번 들어간다
    let settled = false;
    const settle = (skipped: boolean) => {
      if (settled) return;
      settled = true;
      const listenedMs = elapsedMs(currentMusicId); // 마감 전에 읽는다 — 이번 체류가 포함돼야 한다
      noteListened(currentMusicId, Date.now() - from);

      const leaving = promptRef.current;
      if (!leaving || hasSent(leaving.target)) return;
      // 20초를 넘겼으면 설문이 떴거나 뜰 조건이었다 — 그건 카드가 제출로 처리한다
      if (!SURVEY_FORCED && listenedMs >= SURVEY_MIN_LISTEN_MS) return;
      // 무응답 행도 비교 상대를 같은 규칙으로 정한다 — 안 그러면 건너뛴 역이 앞 곡으로 실린다
      const target = resolve(leaving, SURVEY_FORCED ? 0 : SURVEY_MIN_LISTEN_MS)?.target ?? leaving.target;
      sendUnanswered({ target, listenedMs, skipped, durationSec: leaving.subject.durationSec });
      markSent(target);
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

  useSurveyTrigger(prompt);

  return <SurveyCard />;
}
