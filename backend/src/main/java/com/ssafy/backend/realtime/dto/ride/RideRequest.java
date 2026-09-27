package com.ssafy.backend.realtime.dto.ride;

import jakarta.validation.constraints.NotBlank;

/**
 * 따라가기 요청. 따라갈 사람만 보낸다.
 * 곡·레이어·좌표는 받지 않는다 — 따라가는 사람은 선장이 서 있는 자리로 간다.
 */
public record RideRequest(@NotBlank String captainEmail) {
}
