package com.ssafy.backend.artwork.dto;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 목록 한 줄. 리더보드와 "내 작품" 이 같은 모양을 쓴다.
 *
 * @param rank       리더보드에서만 채운다. 내 작품 목록에서는 null
 * @param score      평가 전·실패면 null. <b>0 이 아니다</b>
 * @param failReason 실패 사유. 소유자 조회에서만 채운다
 * @param rankScore  순위 점수 = 좋아요 + AI / 100 × K (S15P21A405-616). 리더보드에서만, 내 작품 목록에서는 null
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
		OffsetDateTime createdAt,
		Double rankScore,
		/** 닫힌 모양 (S15P21A405-616). */
		boolean closed,
		/** 별자리 좌표 + 곡 이름, position 순 (S15P21A405-616). 리더보드만 채우고 내 작품 목록은 빈 목록. */
		List<ArtworkTrack> points) {
}
