package com.ssafy.backend.artwork.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.ssafy.backend.artwork.dto.ArtworkPointRow;
import com.ssafy.backend.artwork.dto.ArtworkRoundRow;
import com.ssafy.backend.artwork.dto.ArtworkRow;
import com.ssafy.backend.artwork.dto.ArtworkSummaryRow;

/**
 * 작품·회차·좌표·좋아요를 한 매퍼에서 다룬다 (S15P21A405-563).
 *
 * <p>네 테이블이지만 항상 함께 움직이는 하나의 집합체(aggregate)라 매퍼를 쪼개지 않았다.
 */
public interface ArtworkMapper {

	// ---- 회차 ----

	/** 지금 열려 있는 회차 1건. 없으면 null. */
	ArtworkRoundRow findOpenRound();

	ArtworkRoundRow findRoundById(@Param("roundId") long roundId);

	// ---- 작품 ----

	/** insert 후 artwork.id 를 파라미터 객체에 채워 돌려준다(시퀀스 selectKey). */
	void insertArtwork(ArtworkRow artwork);

	ArtworkRow findById(@Param("artworkId") long artworkId);

	/** 같은 사람이 같은 회차에 이미 낸 작품. 없으면 null. */
	ArtworkRow findByRoundAndEmail(@Param("roundId") long roundId, @Param("email") String email);

	void deleteById(@Param("artworkId") long artworkId);

	/**
	 * 평가할 작품을 집는다. {@code FOR UPDATE SKIP LOCKED} 라 인스턴스가 늘어도 같은 작품을
	 * 두 번 평가하지 않는다.
	 */
	List<ArtworkRow> lockPendingForEvaluation(@Param("limit") int limit);

	/**
	 * 평가 성공을 기록한다. <b>PENDING 인 행만</b> 바꾼다 — 그 사이 작품이 지워졌거나 상태가
	 * 달라졌으면 0행이고, 호출자는 조용히 끝낸다.
	 *
	 * @return 바뀐 행 수
	 */
	int markScored(
			@Param("artworkId") long artworkId,
			@Param("score") int score,
			@Param("aiComment") String aiComment,
			@Param("model") String model);

	/** 평가 실패를 기록한다. {@code score} 는 건드리지 않는다 — null 로 남는다. */
	int markFailed(@Param("artworkId") long artworkId, @Param("failReason") String failReason);

	/** 실패한 작품을 다시 대기로 되돌린다(재평가). */
	int markPendingAgain(@Param("artworkId") long artworkId);

	/**
	 * 회차의 채점 기준 그림({@code is_anchor = true}). 점수 내림차순. 사람이 SQL 로 넣는 행이라
	 * 리더보드·내 작품·회차당 1작품 검사 어디에도 나오지 않는다.
	 */
	List<ArtworkRow> findAnchors(@Param("roundId") long roundId);

	// ---- 좌표 ----

	void insertPoints(@Param("artworkId") long artworkId, @Param("points") List<ArtworkPointRow> points);

	/** position 오름차순. */
	List<ArtworkPointRow> findPoints(@Param("artworkId") long artworkId);

	// ---- 목록 ----

	/**
	 * 리더보드. {@code SCORED} 만, 점수 내림차순 → 좋아요 내림차순 → 먼저 제출한 순.
	 *
	 * @param requesterEmail 비로그인이면 null. {@code likedByMe} 가 전부 false 가 된다
	 */
	List<ArtworkSummaryRow> findLeaderboard(
			@Param("roundId") long roundId,
			@Param("requesterEmail") String requesterEmail,
			@Param("offset") int offset,
			@Param("limit") int limit);

	int countLeaderboard(@Param("roundId") long roundId);

	/** 내 작품. 상태를 가리지 않는다. */
	List<ArtworkSummaryRow> findMine(@Param("email") String email);

	// ---- 좋아요 ----

	/** 이미 눌러둔 좋아요면 아무것도 하지 않는다(ON CONFLICT DO NOTHING). 실제로 넣었으면 1. */
	int insertLike(@Param("artworkId") long artworkId, @Param("email") String email);

	/** 누른 적 없으면 0. 실제로 지웠으면 1. */
	int deleteLike(@Param("artworkId") long artworkId, @Param("email") String email);

	/** like_cnt 를 delta 만큼 더한다. 0 밑으로는 내려가지 않는다. */
	void addLikeCnt(@Param("artworkId") long artworkId, @Param("delta") int delta);

	int findLikeCnt(@Param("artworkId") long artworkId);

	boolean existsLike(@Param("artworkId") long artworkId, @Param("email") String email);
}
