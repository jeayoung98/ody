package com.ssafy.backend.music.dto;

import java.util.List;

/**
 * 지도 위 한 점(별). 레이어 상주 집합의 원소다 (D18, FE {@code MapPoint} 계약).
 *
 * 좌표는 PC 16개를 그대로 싣는다 — 클라이언트가 현재 레이어 축 pc(2n-1)·pc(2n) 으로 재투영하기 때문이다.
 * 정본 §0.6 {@code MusicDetail} 의 상세 필드(bpm·duration·album·genres·playCnt·youtubeCnt)는 담지 않는다.
 * 담으면 {@code map_sample} 이 조인을 없애 얻은 0.4 ms 이점이 사라진다. 상세는 {@code /music/{id}} 담당이다.
 *
 * @param musicId  {@code music.id} (1..6,624,399)
 * @param pc       PC 16개. 순서는 pc1..pc16
 * @param genreId  색상 코딩용. <b>비음수여야 한다</b>. FE 는 {@code design-tokens.ts} 의
 *                 {@code genreIdx() = Math.abs(genreId) % GENRE_COLORS.length} 로 색·스프라이트를 모두 고르므로
 *                 음수가 가도 터지지는 않지만(2026-09-12 FE 확인, origin/frontend/dev), 서버가 음수를 보낼
 *                 이유가 없어 검증은 유지한다
 * @param weight   별 크기·밝기·클라이언트 선별용 가중치. 인기 지표 부재로 현재는 균일값이다(D17)
 * @param artist   없을 수 있다
 * @param playable 재생 링크 유무. {@code youtube_url} 이 전 행 NULL 이라 현재는 전부 false
 */
public record MapPoint(
		long musicId,
		List<Double> pc,
		int genreId,
		int weight,
		String title,
		String artist,
		boolean playable) {

	/** 좌표 차원. data D7 로 PCA-16 확정, {@code manifest.k} 와 같아야 한다. */
	public static final int PC_DIMS = 16;

	public MapPoint {
		if (pc == null || pc.size() != PC_DIMS) {
			throw new IllegalArgumentException("pc 는 %d개여야 한다: %s".formatted(PC_DIMS, pc == null ? "null" : pc.size()));
		}
		if (genreId < 0) {
			throw new IllegalArgumentException("genreId 는 비음수여야 한다 (FE raw modulo): " + genreId);
		}
		pc = List.copyOf(pc);
	}
}
