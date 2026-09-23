package com.ssafy.backend.artwork.dto;

import java.util.List;

/**
 * 고양이 플레이리스트 생성 응답.
 *
 * <p>{@code points} 는 배치 API({@code POST /api/constellations/layout})가 이 플레이리스트에 돌려주는
 * 것과 <b>같은 값</b>이다 — 같은 함수로 계산한다. 프론트는 이걸로 바로 별자리를 그릴 수 있다.
 *
 * @param fitError 템플릿 점과 실제 곡 위치의 평균 거리를 템플릿 반폭으로 나눈 값. 0 이 완벽, 0.1 이면
 *                 점 하나가 평균 반폭의 10% 만큼 어긋났다는 뜻. 곡 밀도가 낮은 자리일수록 커진다
 */
public record CatPlaylistResponse(
		long playlistId,
		String playlistName,
		String template,
		int musicCnt,
		double fitError,
		List<ArtworkPoint> points) {
}
