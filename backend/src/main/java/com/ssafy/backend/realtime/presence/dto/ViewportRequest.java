package com.ssafy.backend.realtime.presence.dto;

import java.util.List;

import com.ssafy.backend.realtime.geometry.Viewport;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * 현재 화면과 여기까지 내려온 경로를 함께 받는다.
 * @code ancestorBounds는 현재 레이어까지 오며 선택한 이전 화면들이다.
 * 같은 현재 좌표라도 내려온 경로가 다르면 다른 곡 집합이므로 이전 범위가 모두 필요하다.
 * x·y 범위를 묶은 LayerBound를 사용한다. 이 구조로 레이어 순서와 범위 개수를 바로 검사할 수 있다.
 *
 * @param requestSeq 화면 요청 순번
 * @param layer 현재 레이어
 * @param minX 현재 화면의 최소 x 좌표
 * @param maxX 현재 화면의 최대 x 좌표
 * @param minY 현재 화면의 최소 y 좌표
 * @param maxY 현재 화면의 최대 y 좌표
 * @param ancestorBounds 이전 레이어에서 선택한 화면 목록. 1레이어는 빈 목록
 */
public record ViewportRequest(
		@NotNull @Positive Long requestSeq,
		@NotNull @Min(1) @Max(8) Integer layer,
		@NotNull Double minX, @NotNull Double maxX,
		@NotNull Double minY, @NotNull Double maxY,
		@NotNull @Valid List<LayerBound> ancestorBounds) {

	/**
	 * 소켓 요청을 화면 범위 객체로 바꾸고 값도 검사한다.
	 * @return 검증이 끝난 화면 범위
	 * @throws IllegalArgumentException 요청 순번이나 화면 범위가 잘못된 경우
	 */
	public Viewport toViewport() {
		if (requestSeq == null || requestSeq <= 0) {
			throw new IllegalArgumentException("요청 순번은 1 이상이어야 한다");
		}
		if (layer == null || minX == null || maxX == null || minY == null || maxY == null
				|| ancestorBounds == null) {
			throw new IllegalArgumentException("화면 범위 값이 빠져 있다");
		}
		List<Viewport.LayerBound> bounds = ancestorBounds.stream()
				.map(ViewportRequest::toLayerBound)
				.toList();
		Viewport viewport = new Viewport(layer, minX, maxX, minY, maxY, bounds);
		viewport.validate();
		return viewport;
	}

	/**
	 * 이전 레이어 범위를 계산용 객체로 바꾼다.
	 * @param bound 소켓으로 받은 이전 화면 범위
	 * @return 계산에 사용할 이전 화면 범위
	 * @throws IllegalArgumentException 필요한 값이 빠진 경우
	 */
	private static Viewport.LayerBound toLayerBound(LayerBound bound) {
		if (bound == null || bound.layer() == null
				|| bound.minX() == null || bound.maxX() == null
				|| bound.minY() == null || bound.maxY() == null) {
			throw new IllegalArgumentException("이전 레이어 범위 값이 빠져 있다");
		}
		return new Viewport.LayerBound(
				bound.layer(), bound.minX(), bound.maxX(), bound.minY(), bound.maxY());
	}

	/**
	 * 한 레이어에서 다음 레이어로 내려갈 때 선택한 화면 범위.
	 *
	 * @param layer 범위를 선택한 레이어
	 * @param minX 최소 x 좌표
	 * @param maxX 최대 x 좌표
	 * @param minY 최소 y 좌표
	 * @param maxY 최대 y 좌표
	 */
	public record LayerBound(
			@NotNull @Min(1) @Max(7) Integer layer,
			@NotNull Double minX, @NotNull Double maxX,
			@NotNull Double minY, @NotNull Double maxY) {
	}
}
