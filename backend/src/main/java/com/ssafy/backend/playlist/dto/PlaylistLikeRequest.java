package com.ssafy.backend.playlist.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * 플레이리스트 좋아요 변경 요청 (S15P21A405-442).
 *
 * liked 는 토글이 아니라 "이 상태로 만들어 달라"는 뜻이다 — true 면 좋아요, false 면 해제.
 * 연타하거나 같은 요청이 재전송돼도 결과가 같아야 해서 현재 상태를 뒤집지 않는다.
 * 누가 누르는지는 토큰 주체라 요청에 없다.
 */
public record PlaylistLikeRequest(
		@NotNull @Min(1) Long playlistId,
		@NotNull Boolean liked) {
}
