package com.ssafy.backend.music.dto;

import java.util.List;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 별자리 배치 요청 (BACKEND-NOTES A-9).
 *
 * <p><b>요청 본문의 다른 필드는 무시한다.</b> 프론트가 지금 함께 보내는 {@code points}(16차원 좌표)를
 * 여기에 두지 않는 것은 의도다 — 좌표 원천은 서버의 서빙 baseline 하나여야 같은 곡 집합이 누구에게나
 * 같은 모양으로 보인다. Jackson 기본 설정이 모르는 필드를 무시하므로 프론트를 고치기 전에도 붙는다.
 *
 * <p>중복 검사는 애너테이션으로 표현할 수 없어 {@code ConstellationService} 가 한다.
 *
 * @param musicIds 배치할 곡. 2개 이상 30개 이하, 각 원소 1 이상, 중복 불가
 */
public record ConstellationLayoutRequest(
		@NotNull @Size(min = ConstellationLayoutRequest.MIN_TRACKS, max = ConstellationLayoutRequest.MAX_TRACKS)
		List<@NotNull @Min(1) Long> musicIds) {

	/** 두 점이 있어야 모양이 성립한다. 프론트도 이 값 미만에서는 호출하지 않는다. */
	public static final int MIN_TRACKS = 2;

	/**
	 * A-9 문서값. 여정 경로(최대 정거장 20)는 들어오지만 <b>플레이리스트는 곡 수 상한이 없어 넘을 수 있다</b> —
	 * 프론트가 30곡으로 잘라 보낸다(2026-09-13 합의). 서버가 임의로 자르지 않는 이유는 사용자가 모르는
	 * 기준으로 곡이 사라지기 때문이다.
	 */
	public static final int MAX_TRACKS = 30;
}
