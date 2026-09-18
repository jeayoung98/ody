package com.ssafy.backend.playlist.dto;

/**
 * 플레이리스트 좋아요 변경 응답 (S15P21A405-442).
 *
 * likeCnt 는 변경 후 값이다 — 프론트가 다시 조회하지 않고 화면 숫자를 갱신한다.
 * liked 는 요청한 상태를 그대로 돌려준다(멱등이라 이미 그 상태였어도 같은 값).
 */
public record PlaylistLikeResponse(
		long playlistId,
		boolean liked,
		int likeCnt) {
}
