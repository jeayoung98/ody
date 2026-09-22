package com.ssafy.backend.artwork.dto;

import java.time.OffsetDateTime;

/**
 * 목록 한 줄. 리더보드와 "내 작품" 이 같은 모양을 쓴다.
 *
 * @param rank       리더보드에서만 채운다. 내 작품 목록에서는 null
 * @param score      평가 전·실패면 null. <b>0 이 아니다</b>
 * @param failReason 실패 사유. 소유자 조회에서만 채운다
 */
public record ArtworkSummary(
		long artworkId,
		Integer rank,
		String title,
		String ownerEmail,
		String status,
		Integer score,
		String aiComment,
		String failReason,
		int likeCnt,
		boolean likedByMe,
		int musicCnt,
		OffsetDateTime createdAt) {
}
