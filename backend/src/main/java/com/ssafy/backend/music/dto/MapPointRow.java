package com.ssafy.backend.music.dto;

import java.util.List;

import lombok.Getter;
import lombok.Setter;

/**
 * 상주 집합 한 행 (MyBatis 결과 매핑 전용, mutable).
 *
 * 좌표는 저장된 {@code location vector(16)} 을 SELECT 에서 16축으로 펼쳐 그대로 받는다
 * (FR-007: 재계산·재투영 없음). 장르는 담지 않는다 — 아래 MajorTrackReaderAdapter 의 genreId 주석 참조.
 */
@Getter
@Setter
public class MapPointRow {

	private Long musicId;
	private String title;
	private String artist;
	/** music.album_mbid — 앨범 커버를 여는 열쇠. 없으면 null (S15P21A405-520). */
	private String albumMbid;

	private double pc1;
	private double pc2;
	private double pc3;
	private double pc4;
	private double pc5;
	private double pc6;
	private double pc7;
	private double pc8;
	private double pc9;
	private double pc10;
	private double pc11;
	private double pc12;
	private double pc13;
	private double pc14;
	private double pc15;
	private double pc16;

	/** MapPoint.pc 는 16개 배열이다(D7 PCA-16). 순서는 pc1..pc16. */
	public List<Double> toPcList() {
		return List.of(pc1, pc2, pc3, pc4, pc5, pc6, pc7, pc8,
				pc9, pc10, pc11, pc12, pc13, pc14, pc15, pc16);
	}
}
