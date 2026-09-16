package com.ssafy.backend.feedback.dto;

import java.util.UUID;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

/**
 * POST /feedback 요청 (정본 §5.1). 곡 하나를 떠날 때(끝남·스킵·이동) 1건.
 *
 * <p>거리·bpm 은 받지 않는다 — 분석 시 {@code music.location}·{@code music.bpm} 을 조인해 계산한다.
 * 여정 응답이 거리를 노출하지 않으므로(FR-023) FE 가 보낼 수도 없다.
 *
 * @param sessionId     탐색 1회 식별자. 결과 목록을 받을 때 FE 가 {@code crypto.randomUUID()} 로 만든다
 * @param anonymousId   브라우저 localStorage 의 UUID. 비로그인 사람 구분(정밀도 분모). 로그인 사용자도 보낸다
 * @param mode          {@code nearby} | {@code journey}
 * @param rank          nearby: 이웃 순위(1..10) / journey: {@code JourneyStop.step}(1..). 0 은 기준곡·출발곡이라 설문 없음
 * @param anchorMusicId nearby: 기준곡 / journey: 출발곡
 * @param targetMusicId journey 필수: 도착곡. nearby 는 null
 * @param prevMusicId   journey: 앞 역(1역은 출발곡). nearby 는 null
 * @param musicId       평가 대상 곡
 * @param verdict       true 비슷·자연스러움 / false 아님 / null 답하지 않고 떠남(설문 미응답)
 * @param reason        verdict=false 면 필수, 아니면 null: {@code dup} 같은 곡 · {@code mood} 분위기 · {@code tempo} 템포 · {@code spoken} 음악 아님 · {@code compare} 이전 곡 이상함
 * @param listenedSec   실제 들은 초
 * @param skipped       사용자가 스킵했는가
 */
public record FeedbackRequest(
		@NotNull UUID sessionId,
		UUID anonymousId,
		@NotNull @Pattern(regexp = "nearby|journey") String mode,
		@NotNull @Min(1) @Max(50) Integer rank,
		@NotNull Long anchorMusicId,
		Long targetMusicId,
		Long prevMusicId,
		@NotNull Long musicId,
		Boolean verdict,
		@Pattern(regexp = "dup|mood|tempo|spoken|compare") String reason,
		@Min(0) @Max(32767) Integer listenedSec,
		Boolean skipped) {
}
