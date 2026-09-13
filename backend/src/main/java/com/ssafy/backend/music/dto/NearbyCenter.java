package com.ssafy.backend.music.dto;

/**
 * 주변 탐색의 기준점 (005 data-model §2-1).
 *
 * <p>호출자가 요청값을 따로 보관하지 않아도 선 연결·중심 표시를 할 수 있도록 응답에 함께 싣는다(FR-004).
 *
 * <p><b>곡이 아닌 좌표로 탐색하는 경우 {@code id}·{@code title}·{@code artist} 는 {@code null} 이다.</b>
 * {@code location} 은 두 경우 모두 채워진다 — 곡 기준이면 그 곡의 좌표, 좌표 기준이면 받은 값 그대로다.
 * 좌표 기준 입력은 FE 확인 대기 상태라 아직 열려 있지 않다(005 D-CENTER-B).
 */
public record NearbyCenter(
		Long id,
		String title,
		String artist,
		Location location) {

	/** 곡을 기준점으로 삼을 때. */
	public static NearbyCenter ofTrack(Long id, String title, String artist, Location location) {
		return new NearbyCenter(id, title, artist, location);
	}
}
