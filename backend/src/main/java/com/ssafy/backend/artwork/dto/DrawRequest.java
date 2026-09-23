package com.ssafy.backend.artwork.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * {@code POST /api/artwork/draw} 요청 (S15P21A405-598).
 *
 * <p>좌표는 <b>캔버스 기준 0~1</b>, x 는 오른쪽, y 는 <b>아래</b>로 증가한다 — 클릭 위치를 캔버스 크기로 나눈 값 그대로다.
 * 점 순서가 곧 연결 순서이자 재생 순서다.
 *
 * @param points 3~20개
 */
public record DrawRequest(
		@NotNull @Size(min = 3, max = 20) List<@NotNull @Valid DrawPoint> points) {

	public record DrawPoint(
			@NotNull @DecimalMin("0") @DecimalMax("1") Double x,
			@NotNull @DecimalMin("0") @DecimalMax("1") Double y) {
	}
}
