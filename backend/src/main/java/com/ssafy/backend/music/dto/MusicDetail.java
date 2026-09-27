package com.ssafy.backend.music.dto;

/**
 * MusicDetail = MusicSummary + mbid/bpm/duration/playCnt/youtubeCnt (정본 §0.6).
 * /music/major 응답 원소도 이 형태(정본 §3.4).
 */
public record MusicDetail(
		Long id,
		String mbid,
		String title,
		String artist,
		Double bpm,
		Integer duration,
		String album,
		/**
		 * 이 곡이 실린 <b>앨범</b>의 MusicBrainz ID. {@code music.album_mbid}, 없으면 null (S15P21A405-520).
		 *
		 * <p>{@code mbid} 는 recording(곡) 쪽이라 앨범 커버를 못 찾는다 — 커버를 여는 열쇠는 이 값이다.
		 * FE 가 이 값으로 Cover Art Archive 를 직접 받고, 없으면 절차적 커버로 떨어진다(S15P21A405-518).
		 */
		String albumMbid,
		/** 발매 연도. music.release_year, 없으면 null (S15P21A405-439). */
		Integer releaseYear,
		String youtubeUrl,
		/** 유튜브 영상 식별자 11자. 확인된 영상이며 없으면 null (spec 006 FR-001). */
		String videoId,
		Location location,
		Integer playCnt,
		Integer youtubeCnt) {
}
