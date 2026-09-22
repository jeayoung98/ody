package com.ssafy.backend.artwork.dto;

import java.time.OffsetDateTime;
import java.util.List;

import com.ssafy.backend.music.dto.MusicDetail;

/**
 * 작품 상세 응답.
 *
 * <p>{@code points} 와 {@code musics} 는 <b>같은 순서</b>다(제출 시점 곡 순서). 다만 곡 행이 지워진
 * 경우 {@code musics} 에서만 빠진다 — 그림이 깨지지 않는 것이 우선이다.
 *
 * @param score      평가 전·실패면 null. <b>0 이 아니다</b>
 * @param failReason 실패 사유. 소유자에게만 채운다
 */
public record ArtworkDetailResponse(
		long artworkId,
		long roundId,
		String theme,
		String title,
		String ownerEmail,
		boolean mine,
		String status,
		Integer score,
		String aiComment,
		String failReason,
		int likeCnt,
		boolean likedByMe,
		List<ArtworkPoint> points,
		List<MusicDetail> musics,
		OffsetDateTime createdAt,
		OffsetDateTime evaluatedAt) {
}
