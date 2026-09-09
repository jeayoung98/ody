package com.ssafy.backend.music.dto;

/**
 * 임베딩 좌표 (정본 §0.6). v2.1-pca16 기준 16차원 PCA 좌표.
 */
public record Location(
		double pc1, double pc2, double pc3, double pc4,
		double pc5, double pc6, double pc7, double pc8,
		double pc9, double pc10, double pc11, double pc12,
		double pc13, double pc14, double pc15, double pc16) {
}
