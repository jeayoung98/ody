package com.ssafy.backend.music.dto;

/**
 * 임베딩 좌표 (정본 §0.6). v2.1-pca16 기준 16차원 PCA 좌표.
 */
public record Location(
		double pc1, double pc2, double pc3, double pc4,
		double pc5, double pc6, double pc7, double pc8,
		double pc9, double pc10, double pc11, double pc12,
		double pc13, double pc14, double pc15, double pc16) {

	/**
	 * 수치 계산용 16칸 배열. 경로 산출이 거리를 수십만 번 재므로 필드 접근 대신 배열로 편다.
	 * 응답 직렬화는 record 그대로 나간다 — 이 배열은 산출 내부에서만 쓴다.
	 */
	public float[] toArray() {
		return new float[] {
				(float) pc1, (float) pc2, (float) pc3, (float) pc4,
				(float) pc5, (float) pc6, (float) pc7, (float) pc8,
				(float) pc9, (float) pc10, (float) pc11, (float) pc12,
				(float) pc13, (float) pc14, (float) pc15, (float) pc16 };
	}
}
