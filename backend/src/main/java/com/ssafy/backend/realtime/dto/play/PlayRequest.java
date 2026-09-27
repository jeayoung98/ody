package com.ssafy.backend.realtime.dto.play;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * POST /music/play 요청. 좌표는 보내지 않는다 — 서버가 musicId 로 계산(위치 조작 방지).
 * source 범위 밖/타입 오류는 역직렬화 단계에서 400(VALIDATION_ERROR).
 *
 * layer 는 처음 자리를 잡을 때만 쓴다. 이미 지도에 서 있으면 무시하고 서버에 있는 레이어를 유지한다.
 * 재생 기록이 없는 사용자는 join 을 못 하므로(입장할 곡이 없다), 첫 재생이 첫 배치가 된다.
 * 그때 어느 레이어에 놓을지를 이 값으로 받는다. 번호는 프론트와 같은 0-based(0 ~ 7)다.
 */
public record PlayRequest(
		@NotNull Long musicId,
		@NotNull PlaySource source,
		@Min(0) @Max(7) Integer layer) {
}
