package com.ssafy.backend.artwork.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.backend.artwork.ArtworkStatus;
import com.ssafy.backend.artwork.dto.ArtworkDetailResponse;
import com.ssafy.backend.artwork.dto.ArtworkLeaderboardResponse;
import com.ssafy.backend.artwork.dto.ArtworkLikeRequest;
import com.ssafy.backend.artwork.dto.ArtworkLikeResponse;
import com.ssafy.backend.artwork.dto.ArtworkPoint;
import com.ssafy.backend.artwork.dto.ArtworkPointRow;
import com.ssafy.backend.artwork.dto.ArtworkRound;
import com.ssafy.backend.artwork.dto.ArtworkRoundRow;
import com.ssafy.backend.artwork.dto.ArtworkRow;
import com.ssafy.backend.artwork.dto.ArtworkSubmitResponse;
import com.ssafy.backend.artwork.dto.ArtworkSummary;
import com.ssafy.backend.artwork.dto.ArtworkSummaryRow;
import com.ssafy.backend.artwork.mapper.ArtworkMapper;
import com.ssafy.backend.common.ArtworkErrorCode;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;
import com.ssafy.backend.music.detail.MusicDetailReader;
import com.ssafy.backend.music.dto.ConstellationPoint;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.music.service.ConstellationService;
import com.ssafy.backend.playlist.dto.PlaylistDetailResponse;
import com.ssafy.backend.playlist.service.PlaylistService;

import lombok.extern.slf4j.Slf4j;

/**
 * 별자리 작품 제출·조회·좋아요 (S15P21A405-563).
 *
 * <p>평가는 여기서 하지 않는다 — {@link ArtworkEvaluationService} 와 스케줄러가 뒤에서 한다.
 * 제출 요청이 LLM 왕복을 기다리면 응답이 초 단위로 늘어지고 타임아웃이 곧 제출 실패가 된다
 * (spec FR-013).
 */
@Slf4j
@Service
public class ArtworkService {

	/** 리더보드 한 페이지 기본 크기. */
	public static final int DEFAULT_PAGE_SIZE = 20;

	/** 한 번에 내려주는 최대 개수. 이보다 크게 요청하면 이 값으로 자른다. */
	public static final int MAX_PAGE_SIZE = 50;

	private final ArtworkMapper artworkMapper;
	private final PlaylistService playlistService;
	private final ConstellationService constellationService;
	private final Optional<MusicDetailReader> musicDetailReader;
	private final String layoutVersion;

	public ArtworkService(
			ArtworkMapper artworkMapper,
			PlaylistService playlistService,
			ConstellationService constellationService,
			Optional<MusicDetailReader> musicDetailReader,
			@Value("${ody.serving.bundle}") String layoutVersion) {
		this.artworkMapper = artworkMapper;
		this.playlistService = playlistService;
		this.constellationService = constellationService;
		this.musicDetailReader = musicDetailReader;
		this.layoutVersion = layoutVersion;
	}

	/**
	 * 지금 열린 회차. 없으면 빈 값 — 오류가 아니다(화면이 "이번 회차 없음" 을 그린다).
	 *
	 * @param requesterEmail 로그인이면 남은 좋아요 수({@code myVotesLeft})를 채운다. 비로그인이면 null
	 */
	public Optional<ArtworkRound> findOpenRound(String requesterEmail) {
		return Optional.ofNullable(artworkMapper.findOpenRound()).map(r -> toRound(r, requesterEmail));
	}

	/**
	 * 플레이리스트를 지금 열린 회차의 작품으로 제출한다.
	 *
	 * <p>소유권 확인과 곡 목록 조회는 {@link PlaylistService#getDetail} 을 그대로 쓴다 —
	 * 같은 규칙을 두 군데 두면 언젠가 갈라진다.
	 *
	 * <p>같은 회차에 이미 낸 작품이 있으면 <b>지우고 새로 만든다</b>. 점수·좋아요는 승계하지 않는다.
	 * 승계하면 점수가 잘 나올 때까지 다시 내는 것이 최적 전략이 된다.
	 *
	 * @param closed 닫힌 모양(마지막 곡 → 첫 곡). 스냅샷으로 남고 채점 그림에 반영된다 (S15P21A405-616)
	 */
	@Transactional
	public ArtworkSubmitResponse submit(long playlistId, boolean closed, String requesterEmail) {
		ArtworkRoundRow round = artworkMapper.findOpenRound();
		if (round == null) {
			throw new CustomException(ArtworkErrorCode.ARTWORK_ROUND_CLOSED);
		}

		PlaylistDetailResponse playlist = playlistService.getDetail(playlistId, requesterEmail);
		List<Long> musicIds = playlist.musics().stream().map(MusicDetail::id).toList();

		// 곡 수 검증·좌표 계산·누락 판정을 배치 API 가 그대로 한다(2~30, 부분 배치 금지).
		List<ConstellationPoint> points = constellationService.layout(musicIds).points();

		ArtworkRow existing = artworkMapper.findByRoundAndEmail(round.getId(), requesterEmail);
		if (existing != null) {
			artworkMapper.deleteById(existing.getId());
			log.info("[Artwork] 재제출로 기존 작품 삭제 artworkId={} roundId={}", existing.getId(), round.getId());
		}

		ArtworkRow artwork = new ArtworkRow();
		artwork.setRoundId(round.getId());
		artwork.setEmail(requesterEmail);
		artwork.setPlaylistId(playlistId);
		artwork.setTitle(playlist.playlistName());
		// 어떤 좌표계의 모양인지. "/pc12" 이전(집합 PCA) 스냅샷과 구분한다 (S15P21A405-595).
		artwork.setLayoutVersion(layoutVersion + "/pc12");
		artwork.setStatus(ArtworkStatus.PENDING.name());
		artwork.setClosed(closed);
		artworkMapper.insertArtwork(artwork);

		List<ArtworkPointRow> pointRows = new ArrayList<>(points.size());
		for (int i = 0; i < points.size(); i++) {
			ConstellationPoint point = points.get(i);
			pointRows.add(new ArtworkPointRow(i, point.musicId(), point.x(), point.y()));
		}
		artworkMapper.insertPoints(artwork.getId(), pointRows);

		log.info("[Artwork] 제출 완료 artworkId={} roundId={} musicCnt={}",
				artwork.getId(), round.getId(), pointRows.size());
		return new ArtworkSubmitResponse(artwork.getId(), ArtworkStatus.PENDING.name());
	}

	/**
	 * 작품 상세.
	 *
	 * <p>아직 점수가 없는 작품은 <b>소유자에게만</b> 보인다. 남에게 403 을 주면 그 작품이 존재한다는
	 * 사실이 새므로 404 로 답한다(spec FR-009).
	 *
	 * @param requesterEmail 비로그인이면 null
	 */
	public ArtworkDetailResponse getDetail(long artworkId, String requesterEmail) {
		ArtworkRow artwork = artworkMapper.findById(artworkId);
		if (artwork == null) {
			throw new CustomException(ArtworkErrorCode.ARTWORK_NOT_FOUND);
		}
		boolean mine = artwork.getEmail().equals(requesterEmail);
		if (!ArtworkStatus.SCORED.name().equals(artwork.getStatus()) && !mine) {
			throw new CustomException(ArtworkErrorCode.ARTWORK_NOT_FOUND);
		}

		ArtworkRoundRow round = artworkMapper.findRoundById(artwork.getRoundId());
		List<ArtworkPointRow> pointRows = artworkMapper.findPoints(artworkId);
		List<Long> musicIds = pointRows.stream().map(ArtworkPointRow::getMusicId).toList();

		log.info("[Artwork] 상세 조회 완료 artworkId={} status={}", artworkId, artwork.getStatus());
		return new ArtworkDetailResponse(
				artwork.getId(),
				artwork.getRoundId(),
				round == null ? null : round.getTheme(),
				artwork.getTitle(),
				artwork.getEmail(),
				mine,
				artwork.getStatus(),
				artwork.getScore(),
				artwork.getAiComment(),
				mine ? artwork.getFailReason() : null,
				artwork.getLikeCnt(),
				requesterEmail != null && artworkMapper.existsLike(artworkId, requesterEmail),
				pointRows.stream().map(p -> new ArtworkPoint(p.getMusicId(), p.getX(), p.getY())).toList(),
				loadMusicDetails(musicIds),
				artwork.getCreatedAt(),
				artwork.getEvaluatedAt(),
				artwork.isClosed());
	}

	/**
	 * 회차 리더보드. 순위 점수(좋아요 + AI / 100 × K) 내림차순 → AI 점수 내림차순 → 먼저 제출한 순 (S15P21A405-616).
	 * K 는 회차 행의 {@code ai_weight} — DB 에서 고치면 다음 조회에 바로 반영된다.
	 *
	 * @param roundId        null 이면 지금 열린 회차
	 * @param requesterEmail 비로그인이면 null
	 */
	public ArtworkLeaderboardResponse getLeaderboard(Long roundId, String requesterEmail, int page, int size) {
		ArtworkRoundRow round = roundId == null
				? artworkMapper.findOpenRound()
				: artworkMapper.findRoundById(roundId);
		if (round == null) {
			throw new CustomException(ArtworkErrorCode.ARTWORK_ROUND_CLOSED);
		}

		int safePage = Math.max(page, 0);
		int safeSize = size <= 0 ? DEFAULT_PAGE_SIZE : Math.min(size, MAX_PAGE_SIZE);
		int offset = safePage * safeSize;

		List<ArtworkSummaryRow> rows =
				artworkMapper.findLeaderboard(round.getId(), round.getAiWeight(), requesterEmail, offset, safeSize);

		List<ArtworkSummary> items = new ArrayList<>(rows.size());
		for (int i = 0; i < rows.size(); i++) {
			items.add(toSummary(rows.get(i), offset + i + 1));
		}

		int totalCnt = artworkMapper.countLeaderboard(round.getId());
		log.info("[Artwork] 리더보드 조회 완료 roundId={} page={} count={}", round.getId(), safePage, items.size());
		return new ArtworkLeaderboardResponse(toRound(round, requesterEmail), items, safePage, safeSize, totalCnt);
	}

	/** 내 작품. 상태를 가리지 않는다. */
	public List<ArtworkSummary> findMine(String requesterEmail) {
		return artworkMapper.findMine(requesterEmail).stream()
				.map(row -> toSummary(row, null))
				.toList();
	}

	/**
	 * 좋아요 변경. 남의 작품에만, 작품 회차가 열려 있을 때만, 회차당 {@code vote_limit} 개까지 (S15P21A405-616).
	 *
	 * <p>{@code liked} 는 토글이 아니라 목표 상태라 같은 요청을 반복해도 결과가 같다 — 이미 누른 작품에
	 * 다시 {@code true} 를 보내면 표를 더 쓰지 않는다. 거두기는 한도와 무관하다(표가 돌아온다).
	 * {@code like_cnt} 는 {@code artwork_like} 의 집계 사본이므로 기록이 실제로 바뀐 경우에만 움직인다.
	 *
	 * @throws CustomException 없는 작품·남의 미채점 {@code ARTWORK_NOT_FOUND}, 내 작품 {@code ARTWORK_VOTE_SELF},
	 *                         닫힌 회차 {@code ARTWORK_ROUND_CLOSED}, 한도 {@code ARTWORK_VOTE_LIMIT}
	 */
	@Transactional
	public ArtworkLikeResponse changeLike(ArtworkLikeRequest request, String requesterEmail) {
		if (request == null || request.artworkId() == null || request.liked() == null) {
			throw new CustomException(GlobalErrorCode.INVALID_INPUT);
		}
		long artworkId = request.artworkId();
		boolean liked = request.liked();

		ArtworkRow artwork = artworkMapper.findById(artworkId);
		// 아직 점수가 없는 남의 작품은 존재를 알 수 없어야 하므로 좋아요도 누를 수 없다.
		if (artwork == null
				|| (!ArtworkStatus.SCORED.name().equals(artwork.getStatus())
						&& !artwork.getEmail().equals(requesterEmail))) {
			throw new CustomException(ArtworkErrorCode.ARTWORK_NOT_FOUND);
		}
		if (artwork.getEmail().equals(requesterEmail)) {
			throw new CustomException(ArtworkErrorCode.ARTWORK_VOTE_SELF);
		}
		// 끝난 회차 순위가 흔들리지 않게 누르기·거두기 모두 막는다.
		ArtworkRoundRow round = artworkMapper.findOpenRound();
		if (round == null || round.getId() != artwork.getRoundId()) {
			throw new CustomException(ArtworkErrorCode.ARTWORK_ROUND_CLOSED);
		}

		Integer votesUsed = null;
		if (liked && !artworkMapper.existsLike(artworkId, requesterEmail)) {
			// 잠금 → 세기 → 넣기가 한 트랜잭션. 같은 사람의 동시 요청이 한도를 넘지 못한다.
			artworkMapper.lockVotes(requesterEmail, round.getId());
			votesUsed = artworkMapper.countVotesInRound(requesterEmail, round.getId());
			if (votesUsed >= round.getVoteLimit()) {
				log.info("[Artwork] 좋아요 거절 — 회차 한도 artworkId={} votesUsed={} limit={}",
						artworkId, votesUsed, round.getVoteLimit());
				throw new CustomException(ArtworkErrorCode.ARTWORK_VOTE_LIMIT);
			}
		}

		int changed = liked
				? artworkMapper.insertLike(artworkId, requesterEmail)
				: artworkMapper.deleteLike(artworkId, requesterEmail);
		if (changed > 0) {
			artworkMapper.addLikeCnt(artworkId, liked ? 1 : -1);
		}

		int likeCnt = artworkMapper.findLikeCnt(artworkId);
		log.info("[Artwork] 좋아요 변경 완료 artworkId={} liked={} changed={} likeCnt={} votesUsedBefore={}",
				artworkId, liked, changed > 0, likeCnt, votesUsed);
		return new ArtworkLikeResponse(artworkId, liked, likeCnt);
	}

	/** 작품 삭제. 좌표·좋아요는 FK ON DELETE CASCADE 로 함께 사라진다. */
	public void delete(long artworkId, String requesterEmail) {
		requireOwned(artworkId, requesterEmail);
		artworkMapper.deleteById(artworkId);
		log.info("[Artwork] 삭제 완료 artworkId={}", artworkId);
	}

	/**
	 * 실패한 작품을 다시 평가 대기로 돌린다. 실제 평가는 스케줄러가 집어간다.
	 *
	 * @param maxAttempts 재시도 상한. 소진했으면 {@code ARTWORK_RETRY_EXHAUSTED}
	 */
	public void retry(long artworkId, String requesterEmail, int maxAttempts) {
		ArtworkRow artwork = requireOwned(artworkId, requesterEmail);
		if (!ArtworkStatus.FAILED.name().equals(artwork.getStatus())) {
			throw new CustomException(ArtworkErrorCode.ARTWORK_NOT_FAILED);
		}
		if (artwork.getAttemptCnt() >= maxAttempts) {
			throw new CustomException(ArtworkErrorCode.ARTWORK_RETRY_EXHAUSTED);
		}
		artworkMapper.markPendingAgain(artworkId);
		log.info("[Artwork] 재평가 요청 artworkId={} attemptCnt={}", artworkId, artwork.getAttemptCnt());
	}

	private ArtworkRow requireOwned(long artworkId, String requesterEmail) {
		ArtworkRow artwork = artworkMapper.findById(artworkId);
		if (artwork == null) {
			throw new CustomException(ArtworkErrorCode.ARTWORK_NOT_FOUND);
		}
		if (!artwork.getEmail().equals(requesterEmail)) {
			throw new CustomException(GlobalErrorCode.FORBIDDEN);
		}
		return artwork;
	}

	/**
	 * 곡 상세를 한 번에 읽어 저장된 순서로 재조립한다. 곡이 지워졌으면 그 자리만 빠진다 —
	 * 좌표는 그대로 남아 그림이 깨지지 않는다.
	 */
	private List<MusicDetail> loadMusicDetails(List<Long> musicIds) {
		if (musicIds.isEmpty() || musicDetailReader.isEmpty()) {
			return List.of();
		}
		Map<Long, MusicDetail> byId = new HashMap<>();
		for (MusicDetail music : musicDetailReader.get().findDetailsByIds(musicIds)) {
			byId.put(music.id(), music);
		}
		List<MusicDetail> musics = new ArrayList<>(musicIds.size());
		for (Long musicId : musicIds) {
			MusicDetail music = byId.get(musicId);
			if (music != null) {
				musics.add(music);
			}
		}
		return musics;
	}

	private static ArtworkSummary toSummary(ArtworkSummaryRow row, Integer rank) {
		return new ArtworkSummary(
				row.getId(),
				rank,
				row.getTitle(),
				row.getEmail(),
				row.getStatus(),
				row.getScore(),
				row.getAiComment(),
				row.getFailReason(),
				row.getLikeCnt(),
				row.isLikedByMe(),
				row.getMusicCnt(),
				row.getCreatedAt(),
				row.getRankScore(),
				row.isClosed());
	}

	/** 회차 응답. 로그인이면 남은 좋아요 수를 센다 — 배포 전 초과분이 있어도 음수로 내려가지 않는다. */
	private ArtworkRound toRound(ArtworkRoundRow row, String requesterEmail) {
		Integer votesLeft = requesterEmail == null
				? null
				: Math.max(0, row.getVoteLimit() - artworkMapper.countVotesInRound(requesterEmail, row.getId()));
		return new ArtworkRound(
				row.getId(), row.getTheme(), row.getStartsAt(), row.getEndsAt(), row.getVoteLimit(), votesLeft);
	}
}
