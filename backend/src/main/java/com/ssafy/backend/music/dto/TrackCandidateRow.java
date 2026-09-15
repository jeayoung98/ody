package com.ssafy.backend.music.dto;

import lombok.Getter;
import lombok.Setter;

/**
 * 좌표 최근접 조회 한 행 (MyBatis 결과 매핑 전용, mutable).
 *
 * <p>좌표는 16축으로 펼쳐 받는다 — 저장된 {@code location vector(16)} 을 그대로 옮기고
 * 재계산·재투영하지 않는다(FR-016). 장르는 담지 않는다: 후보를 층당 200개씩 n회 뽑으므로
 * 조인 비용이 그대로 지연이 되고, 핸드오프 §1 도 "장르는 조인하지 않는다"고 적었다.
 */
@Getter
@Setter
public class TrackCandidateRow {

	private Long musicId;
	private String mbid;
	private String title;
	private String artist;
	private Integer duration;
	/** 질의 좌표와의 L2 거리. SQL 의 {@code <->} 가 계산해 준다. */
	private double dist;

	private float pc1;
	private float pc2;
	private float pc3;
	private float pc4;
	private float pc5;
	private float pc6;
	private float pc7;
	private float pc8;
	private float pc9;
	private float pc10;
	private float pc11;
	private float pc12;
	private float pc13;
	private float pc14;
	private float pc15;
	private float pc16;

	/** 산출이 쓰는 16칸 배열. DP 가 거리를 수십만 번 재므로 배열로 편다. */
	public float[] toVec() {
		return new float[] { pc1, pc2, pc3, pc4, pc5, pc6, pc7, pc8,
				pc9, pc10, pc11, pc12, pc13, pc14, pc15, pc16 };
	}
}
