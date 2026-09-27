package com.ssafy.backend.artwork;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mockito;

import com.ssafy.backend.artwork.dto.ArtworkDetailResponse;
import com.ssafy.backend.artwork.dto.ArtworkLeaderboardResponse;
import com.ssafy.backend.artwork.dto.ArtworkLikeRequest;
import com.ssafy.backend.artwork.dto.ArtworkPointRow;
import com.ssafy.backend.artwork.dto.ArtworkRoundRow;
import com.ssafy.backend.artwork.dto.ArtworkRow;
import com.ssafy.backend.artwork.dto.ArtworkSubmitResponse;
import com.ssafy.backend.artwork.dto.ArtworkSummaryRow;
import com.ssafy.backend.artwork.dto.ArtworkTrack;
import com.ssafy.backend.artwork.mapper.ArtworkMapper;
import com.ssafy.backend.artwork.service.ArtworkService;
import com.ssafy.backend.common.ArtworkErrorCode;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;
import com.ssafy.backend.music.detail.MusicDetailReader;
import com.ssafy.backend.music.dto.ConstellationLayoutResponse;
import com.ssafy.backend.music.dto.ConstellationPoint;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.music.dto.MusicSummary;
import com.ssafy.backend.music.service.ConstellationService;
import com.ssafy.backend.playlist.dto.PlaylistDetailResponse;
import com.ssafy.backend.playlist.service.PlaylistService;

/**
 * 제출·조회·좋아요의 규칙 (S15P21A405-563).
 *
 * <p>여기서 지키는 핵심은 <b>작품이 제출 시점에 굳는다</b>는 것이다 — 원본 플레이리스트를 뒤에서
 * 어떻게 고치든 작품의 곡·좌표·점수는 변하지 않아야 한다(spec FR-003).
 */
class ArtworkServiceTests {

	private static final String OWNER = "owner@ody.com";
	private static final String OTHER = "other@ody.com";

	private ArtworkMapper artworkMapper;
	private PlaylistService playlistService;
	private ConstellationService constellationService;
	private ArtworkService service;

	@BeforeEach
	void setUp() {
		artworkMapper = Mockito.mock(ArtworkMapper.class);
		playlistService = Mockito.mock(PlaylistService.class);
		constellationService = Mockito.mock(ConstellationService.class);
		// 곡 조회 어댑터 없이도 성립해야 한다 — 그림(좌표)이 우선이고 곡 정보는 곁들이다.
		service = new ArtworkService(
				artworkMapper, playlistService, constellationService, Optional.empty(), "v2.1-pca16");
	}

	// ---------------- 제출 ----------------

	@Test
	void submit_rejectsWhenNoOpenRound() {
		when(artworkMapper.findOpenRound()).thenReturn(null);

		assertThatThrownBy(() -> service.submit(1L, false, OWNER))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(ArtworkErrorCode.ARTWORK_ROUND_CLOSED);

		verify(artworkMapper, never()).insertArtwork(any());
	}

	/** 소유권 검사는 PlaylistService 가 한다. 같은 규칙을 두 군데 두지 않으려는 선택이다. */
	@Test
	void submit_propagatesForbiddenFromPlaylist() {
		when(artworkMapper.findOpenRound()).thenReturn(round());
		when(playlistService.getDetail(1L, OTHER)).thenThrow(new CustomException(GlobalErrorCode.FORBIDDEN));

		assertThatThrownBy(() -> service.submit(1L, false, OTHER))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(GlobalErrorCode.FORBIDDEN);

		verify(artworkMapper, never()).insertArtwork(any());
	}

	/** 곡 수 검증(2~30)·좌표 누락 판정은 배치 API 가 그대로 한다. 여기서 다시 구현하지 않는다. */
	@Test
	void submit_propagatesInvalidInputFromLayout() {
		when(artworkMapper.findOpenRound()).thenReturn(round());
		when(playlistService.getDetail(1L, OWNER)).thenReturn(playlistWith(10L));
		when(constellationService.layout(any())).thenThrow(new CustomException(GlobalErrorCode.INVALID_INPUT));

		assertThatThrownBy(() -> service.submit(1L, false, OWNER))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(GlobalErrorCode.INVALID_INPUT);

		verify(artworkMapper, never()).insertArtwork(any());
	}

	@Test
	void submit_storesSnapshotOfPointsAndTitle() {
		when(artworkMapper.findOpenRound()).thenReturn(round());
		when(playlistService.getDetail(1L, OWNER)).thenReturn(playlistWith(10L, 11L));
		when(constellationService.layout(List.of(10L, 11L))).thenReturn(new ConstellationLayoutResponse(
				List.of(new ConstellationPoint(10L, -0.5, 0.25), new ConstellationPoint(11L, 0.5, -0.25))));

		ArtworkSubmitResponse response = service.submit(1L, false, OWNER);

		assertThat(response.status()).isEqualTo(ArtworkStatus.PENDING.name());

		ArgumentCaptor<ArtworkRow> artwork = ArgumentCaptor.forClass(ArtworkRow.class);
		verify(artworkMapper).insertArtwork(artwork.capture());
		assertThat(artwork.getValue().getStatus()).isEqualTo(ArtworkStatus.PENDING.name());
		assertThat(artwork.getValue().getEmail()).isEqualTo(OWNER);
		assertThat(artwork.getValue().getTitle()).isEqualTo("밤산책");
		// 어떤 좌표 baseline·좌표계의 모양인지 남는다 (헌법 V). "/pc12" 가 붙지 않은 것은 집합 PCA 시절 스냅샷이다.
		assertThat(artwork.getValue().getLayoutVersion()).isEqualTo("v2.1-pca16/pc12");

		@SuppressWarnings("unchecked")
		ArgumentCaptor<List<ArtworkPointRow>> points = ArgumentCaptor.forClass(List.class);
		verify(artworkMapper).insertPoints(anyLong(), points.capture());
		assertThat(points.getValue()).hasSize(2);
		assertThat(points.getValue().get(0).getPosition()).isZero();
		assertThat(points.getValue().get(0).getMusicId()).isEqualTo(10L);
		assertThat(points.getValue().get(0).getX()).isEqualTo(-0.5);
		assertThat(points.getValue().get(1).getPosition()).isEqualTo(1);
	}

	/** 닫힌 모양은 출품 스냅샷에 남는다. 안 보내면(기존 클라이언트) 열린 모양 (S15P21A405-616). */
	@Test
	void submit_storesClosedFlag() {
		when(artworkMapper.findOpenRound()).thenReturn(round());
		when(playlistService.getDetail(1L, OWNER)).thenReturn(playlistWith(10L, 11L));
		when(constellationService.layout(any())).thenReturn(new ConstellationLayoutResponse(
				List.of(new ConstellationPoint(10L, 0.0, 0.0), new ConstellationPoint(11L, 1.0, 1.0))));

		service.submit(1L, true, OWNER);
		service.submit(1L, false, OWNER);

		ArgumentCaptor<ArtworkRow> artwork = ArgumentCaptor.forClass(ArtworkRow.class);
		verify(artworkMapper, times(2)).insertArtwork(artwork.capture());
		assertThat(artwork.getAllValues()).extracting(ArtworkRow::isClosed).containsExactly(true, false);
	}

	@Test
	void detailAndLeaderboard_carryClosedFlag() {
		ArtworkRow closed = artwork(5L, ArtworkStatus.SCORED, OWNER);
		closed.setClosed(true);
		when(artworkMapper.findById(5L)).thenReturn(closed);
		when(artworkMapper.findPoints(5L)).thenReturn(List.of());
		when(artworkMapper.findRoundById(1L)).thenReturn(round());
		ArtworkSummaryRow row = summaryRow(5L);
		row.setClosed(true);
		when(artworkMapper.findLeaderboard(anyLong(), anyDouble(), any(), anyInt(), anyInt())).thenReturn(List.of(row));

		assertThat(service.getDetail(5L, OTHER).closed()).isTrue();
		assertThat(service.getLeaderboard(1L, null, 0, 20).items().get(0).closed()).isTrue();
	}

	@Test
	void detailAndLeaderboard_carryOwnerNickname() {
		ArtworkRow artwork = artwork(5L, ArtworkStatus.SCORED, OWNER);
		artwork.setOwnerNickname("루나");
		when(artworkMapper.findById(5L)).thenReturn(artwork);
		when(artworkMapper.findPoints(5L)).thenReturn(List.of());
		when(artworkMapper.findRoundById(1L)).thenReturn(round());
		ArtworkSummaryRow row = summaryRow(5L);
		row.setOwnerNickname("루나");
		when(artworkMapper.findLeaderboard(anyLong(), anyDouble(), any(), anyInt(), anyInt())).thenReturn(List.of(row));

		assertThat(service.getDetail(5L, OTHER).ownerNickname()).isEqualTo("루나");
		assertThat(service.getLeaderboard(1L, null, 0, 20).items().get(0).ownerNickname()).isEqualTo("루나");
	}

	/** 같은 회차 재제출은 기존 작품을 지우고 새로 만든다 — 점수·좋아요를 승계하지 않는다. */
	@Test
	void submit_replacesExistingArtworkInSameRound() {
		when(artworkMapper.findOpenRound()).thenReturn(round());
		when(playlistService.getDetail(1L, OWNER)).thenReturn(playlistWith(10L, 11L));
		when(constellationService.layout(any())).thenReturn(new ConstellationLayoutResponse(
				List.of(new ConstellationPoint(10L, 0.0, 0.0), new ConstellationPoint(11L, 1.0, 1.0))));
		ArtworkRow existing = artwork(99L, ArtworkStatus.SCORED, OWNER);
		when(artworkMapper.findByRoundAndEmail(1L, OWNER)).thenReturn(existing);

		service.submit(1L, false, OWNER);

		verify(artworkMapper).deleteById(99L);
		verify(artworkMapper).insertArtwork(any());
	}

	// ---------------- 상세 ----------------

	/** 아직 점수가 없는 남의 작품은 존재를 알 수 없어야 한다 — 403 이 아니라 404 다. */
	@Test
	void detail_hidesOthersPendingArtwork() {
		when(artworkMapper.findById(5L)).thenReturn(artwork(5L, ArtworkStatus.PENDING, OWNER));

		assertThatThrownBy(() -> service.getDetail(5L, OTHER))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(ArtworkErrorCode.ARTWORK_NOT_FOUND);
	}

	@Test
	void detail_showsOwnPendingArtwork() {
		ArtworkRow row = artwork(5L, ArtworkStatus.PENDING, OWNER);
		row.setFailReason(null);
		when(artworkMapper.findById(5L)).thenReturn(row);
		when(artworkMapper.findRoundById(1L)).thenReturn(round());
		when(artworkMapper.findPoints(5L)).thenReturn(List.of(new ArtworkPointRow(0, 10L, 0.1, 0.2)));

		ArtworkDetailResponse detail = service.getDetail(5L, OWNER);

		assertThat(detail.mine()).isTrue();
		assertThat(detail.status()).isEqualTo(ArtworkStatus.PENDING.name());
		assertThat(detail.points()).singleElement()
				.satisfies(p -> assertThat(p.musicId()).isEqualTo(10L));
	}

	/**
	 * 상세의 좌표는 <b>artwork_point</b> 에서 나온다. 원본 플레이리스트를 다시 읽지 않는다 —
	 * 이것이 "제출 뒤 원본을 고쳐도 작품이 변하지 않는다" 의 실제 근거다.
	 */
	@Test
	void detail_readsSnapshotNotPlaylist() {
		when(artworkMapper.findById(5L)).thenReturn(artwork(5L, ArtworkStatus.SCORED, OWNER));
		when(artworkMapper.findRoundById(1L)).thenReturn(round());
		when(artworkMapper.findPoints(5L)).thenReturn(List.of(
				new ArtworkPointRow(0, 10L, 0.1, 0.2), new ArtworkPointRow(1, 11L, -0.1, -0.2)));

		ArtworkDetailResponse detail = service.getDetail(5L, OTHER);

		assertThat(detail.points()).hasSize(2);
		verify(playlistService, never()).getDetail(anyLong(), anyString());
	}

	/** 실패 사유는 소유자에게만 보인다. */
	@Test
	void detail_hidesFailReasonFromOthers() {
		ArtworkRow row = artwork(5L, ArtworkStatus.SCORED, OWNER);
		row.setFailReason("AI 채점 실패");
		when(artworkMapper.findById(5L)).thenReturn(row);
		when(artworkMapper.findRoundById(1L)).thenReturn(round());
		when(artworkMapper.findPoints(5L)).thenReturn(List.of());

		assertThat(service.getDetail(5L, OTHER).failReason()).isNull();
		assertThat(service.getDetail(5L, OWNER).failReason()).isEqualTo("AI 채점 실패");
	}

	// ---------------- 리더보드 ----------------

	@Test
	void leaderboard_numbersRanksAcrossPages() {
		when(artworkMapper.findRoundById(1L)).thenReturn(round());
		when(artworkMapper.findLeaderboard(eq(1L), eq(5.0), any(), eq(20), eq(20)))
				.thenReturn(List.of(summaryRow(7L), summaryRow(8L)));
		when(artworkMapper.countLeaderboard(1L)).thenReturn(42);

		ArtworkLeaderboardResponse response = service.getLeaderboard(1L, OWNER, 1, 20);

		assertThat(response.items()).extracting("rank").containsExactly(21, 22);
		assertThat(response.totalCnt()).isEqualTo(42);
	}

	/** 한 번에 내려주는 개수는 상한에서 자른다. size=1000 으로 전체를 긁어가지 못한다. */
	@Test
	void leaderboard_capsPageSize() {
		when(artworkMapper.findRoundById(1L)).thenReturn(round());
		when(artworkMapper.findLeaderboard(anyLong(), anyDouble(), any(), anyInt(), anyInt())).thenReturn(List.of());

		ArtworkLeaderboardResponse response = service.getLeaderboard(1L, null, 0, 1000);

		assertThat(response.size()).isEqualTo(ArtworkService.MAX_PAGE_SIZE);
		verify(artworkMapper).findLeaderboard(1L, 5.0, null, 0, ArtworkService.MAX_PAGE_SIZE);
	}


	/** 순위 점수는 회차 K 로 SQL 이 계산한다 — 서비스는 K 를 넘기고 값을 그대로 싣는다 (S15P21A405-616). */
	@Test
	void leaderboard_passesRoundAiWeight_andCarriesRankScore() {
		ArtworkRoundRow r = round();
		r.setAiWeight(10);
		when(artworkMapper.findRoundById(1L)).thenReturn(r);
		ArtworkSummaryRow first = summaryRow(7L);
		first.setRankScore(14.0);
		ArtworkSummaryRow second = summaryRow(8L);
		second.setRankScore(9.0);
		when(artworkMapper.findLeaderboard(eq(1L), eq(10.0), any(), eq(0), eq(20))).thenReturn(List.of(first, second));

		ArtworkLeaderboardResponse response = service.getLeaderboard(1L, null, 0, 20);

		assertThat(response.items()).extracting("rankScore").containsExactly(14.0, 9.0);
		assertThat(response.items()).extracting("rank").containsExactly(1, 2);
	}

	/** 리더보드 카드의 별자리·곡 이름 — 페이지당 좌표 1회·곡 이름 1회 (S15P21A405-616). */
	@Test
	void leaderboard_attachesTracks_withTwoQueriesPerPage() {
		MusicDetailReader reader = Mockito.mock(MusicDetailReader.class);
		ArtworkService withReader = new ArtworkService(
				artworkMapper, playlistService, constellationService, Optional.of(reader), "v2.1-pca16");
		when(artworkMapper.findRoundById(1L)).thenReturn(round());
		when(artworkMapper.findLeaderboard(anyLong(), anyDouble(), any(), anyInt(), anyInt()))
				.thenReturn(List.of(summaryRow(7L), summaryRow(8L)));
		when(artworkMapper.findPointsByArtworkIds(List.of(7L, 8L))).thenReturn(List.of(
				point(7L, 0, 10L, -0.5, 0.5), point(7L, 1, 11L, 0.5, 0.5), point(8L, 0, 12L, 0.0, -0.5)));
		when(reader.findSummariesByIds(any())).thenReturn(List.of(
				new MusicSummary(10L, "곡10", "가수10", null, null, null, null),
				new MusicSummary(12L, "곡12", null, null, null, null, null)));   // 11 은 지워진 곡

		ArtworkLeaderboardResponse response = withReader.getLeaderboard(1L, null, 0, 20);

		List<ArtworkTrack> first = response.items().get(0).points();
		assertThat(first).extracting(ArtworkTrack::musicId).containsExactly(10L, 11L);
		assertThat(first).extracting(ArtworkTrack::title).containsExactly("곡10", null);
		assertThat(response.items().get(1).points()).extracting(ArtworkTrack::title).containsExactly("곡12");
		verify(artworkMapper, times(1)).findPointsByArtworkIds(any());
		verify(reader, times(1)).findSummariesByIds(any());
	}

	@Test
	void leaderboard_emptyPage_skipsTrackQueries() {
		when(artworkMapper.findRoundById(1L)).thenReturn(round());
		when(artworkMapper.findLeaderboard(anyLong(), anyDouble(), any(), anyInt(), anyInt())).thenReturn(List.of());

		assertThat(service.getLeaderboard(1L, null, 0, 20).items()).isEmpty();
		verify(artworkMapper, never()).findPointsByArtworkIds(any());
	}

	/** 상세 tracks 는 좌표 순서 그대로, 지워진 곡도 원소가 남고 이름만 null (analyze U1). */
	@Test
	void detail_tracksKeepPointOrder_evenWhenSongDeleted() {
		MusicDetailReader reader = Mockito.mock(MusicDetailReader.class);
		ArtworkService withReader = new ArtworkService(
				artworkMapper, playlistService, constellationService, Optional.of(reader), "v2.1-pca16");
		when(artworkMapper.findById(5L)).thenReturn(artwork(5L, ArtworkStatus.SCORED, OWNER));
		when(artworkMapper.findPoints(5L)).thenReturn(List.of(
				new ArtworkPointRow(0, 10L, -0.5, 0.5), new ArtworkPointRow(1, 11L, 0.5, 0.5)));
		when(reader.findDetailsByIds(any())).thenReturn(List.of(new MusicDetail(
				11L, null, "곡11", "가수11", null, 200, null, null, null, null, null, null, null, null)));

		ArtworkDetailResponse detail = withReader.getDetail(5L, OTHER);

		assertThat(detail.tracks()).extracting(ArtworkTrack::musicId).containsExactly(10L, 11L);
		assertThat(detail.tracks()).extracting(ArtworkTrack::title).containsExactly(null, "곡11");
		assertThat(detail.musics()).hasSize(1);   // 기존 필드는 그대로(지워진 곡이 빠진다)
	}

	@Test
	void mine_hasNoRankScore() {
		when(artworkMapper.findMine(OWNER)).thenReturn(List.of(summaryRow(7L)));

		assertThat(service.findMine(OWNER)).extracting("rankScore").containsOnlyNulls();
	}

	// ---------------- 좋아요 ----------------

	/** 기록이 실제로 바뀐 경우에만 집계를 움직인다 — 연타로 숫자가 부풀지 않는다. */
	@Test
	void like_doesNotChangeCountWhenAlreadyLiked() {
		when(artworkMapper.findById(5L)).thenReturn(artwork(5L, ArtworkStatus.SCORED, OWNER));
		when(artworkMapper.findOpenRound()).thenReturn(round());
		when(artworkMapper.existsLike(5L, OTHER)).thenReturn(true);
		when(artworkMapper.insertLike(5L, OTHER)).thenReturn(0);
		when(artworkMapper.findLikeCnt(5L)).thenReturn(3);

		assertThat(service.changeLike(new ArtworkLikeRequest(5L, true), OTHER).likeCnt()).isEqualTo(3);

		verify(artworkMapper, never()).addLikeCnt(anyLong(), anyInt());
	}

	@Test
	void like_incrementsOnceWhenNewlyLiked() {
		when(artworkMapper.findById(5L)).thenReturn(artwork(5L, ArtworkStatus.SCORED, OWNER));
		when(artworkMapper.findOpenRound()).thenReturn(round());
		when(artworkMapper.insertLike(5L, OTHER)).thenReturn(1);
		when(artworkMapper.findLikeCnt(5L)).thenReturn(4);

		service.changeLike(new ArtworkLikeRequest(5L, true), OTHER);

		verify(artworkMapper, times(1)).addLikeCnt(5L, 1);
	}

	@Test
	void like_rejectsOthersPendingArtwork() {
		when(artworkMapper.findById(5L)).thenReturn(artwork(5L, ArtworkStatus.PENDING, OWNER));

		assertThatThrownBy(() -> service.changeLike(new ArtworkLikeRequest(5L, true), OTHER))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(ArtworkErrorCode.ARTWORK_NOT_FOUND);
	}


	// ---------------- 회차당 좋아요 한도 (S15P21A405-616) ----------------

	private void openRoundWithVotesUsed(int used) {
		when(artworkMapper.findById(5L)).thenReturn(artwork(5L, ArtworkStatus.SCORED, OWNER));
		when(artworkMapper.findOpenRound()).thenReturn(round());
		when(artworkMapper.countVotesInRound(OTHER, 1L)).thenReturn(used);
	}

	@Test
	void like_rejectsFourthVoteInRound() {
		openRoundWithVotesUsed(3);

		assertThatThrownBy(() -> service.changeLike(new ArtworkLikeRequest(5L, true), OTHER))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(ArtworkErrorCode.ARTWORK_VOTE_LIMIT);
		verify(artworkMapper, never()).insertLike(anyLong(), anyString());
	}

	@Test
	void like_allowedWhileUnderLimit_locksBeforeCounting() {
		openRoundWithVotesUsed(2);
		when(artworkMapper.insertLike(5L, OTHER)).thenReturn(1);

		service.changeLike(new ArtworkLikeRequest(5L, true), OTHER);

		InOrder order = Mockito.inOrder(artworkMapper);
		order.verify(artworkMapper).lockVotes(OTHER, 1L);
		order.verify(artworkMapper).countVotesInRound(OTHER, 1L);
		order.verify(artworkMapper).insertLike(5L, OTHER);
	}

	/** 거두기는 한도와 무관하다 — 표를 돌려받는 동작이다. */
	@Test
	void unlike_skipsLimitAndLock() {
		openRoundWithVotesUsed(3);
		when(artworkMapper.deleteLike(5L, OTHER)).thenReturn(1);

		service.changeLike(new ArtworkLikeRequest(5L, false), OTHER);

		verify(artworkMapper).addLikeCnt(5L, -1);
		verify(artworkMapper, never()).lockVotes(anyString(), anyLong());
		verify(artworkMapper, never()).countVotesInRound(anyString(), anyLong());
	}

	/** 이미 누른 작품에 다시 true — 표를 더 쓰지 않으므로 한도에 걸리지 않는다(멱등). */
	@Test
	void like_repeatOnAlreadyLiked_skipsLimit() {
		openRoundWithVotesUsed(3);
		when(artworkMapper.existsLike(5L, OTHER)).thenReturn(true);

		service.changeLike(new ArtworkLikeRequest(5L, true), OTHER);

		verify(artworkMapper, never()).lockVotes(anyString(), anyLong());
	}

	@Test
	void like_rejectsOwnArtwork() {
		when(artworkMapper.findById(5L)).thenReturn(artwork(5L, ArtworkStatus.SCORED, OWNER));

		assertThatThrownBy(() -> service.changeLike(new ArtworkLikeRequest(5L, true), OWNER))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(ArtworkErrorCode.ARTWORK_VOTE_SELF);
	}

	/** 끝난 회차 순위가 흔들리지 않게 누르기·거두기 모두 막는다. */
	@Test
	void like_rejectsArtworkOfClosedRound_bothDirections() {
		ArtworkRow old = artwork(5L, ArtworkStatus.SCORED, OWNER);
		old.setRoundId(99L);
		when(artworkMapper.findById(5L)).thenReturn(old);
		when(artworkMapper.findOpenRound()).thenReturn(round());

		for (boolean liked : new boolean[] {true, false}) {
			assertThatThrownBy(() -> service.changeLike(new ArtworkLikeRequest(5L, liked), OTHER))
					.isInstanceOf(CustomException.class)
					.extracting(e -> ((CustomException) e).getErrorCode())
					.isEqualTo(ArtworkErrorCode.ARTWORK_ROUND_CLOSED);
		}
		verify(artworkMapper, never()).insertLike(anyLong(), anyString());
		verify(artworkMapper, never()).deleteLike(anyLong(), anyString());
	}

	@Test
	void currentRound_votesLeft_forLoggedInOnly_neverNegative() {
		when(artworkMapper.findOpenRound()).thenReturn(round());
		when(artworkMapper.countVotesInRound(OTHER, 1L)).thenReturn(1);
		when(artworkMapper.countVotesInRound(OWNER, 1L)).thenReturn(4);   // 배포 전 초과분

		assertThat(service.findOpenRound(OTHER).orElseThrow().myVotesLeft()).isEqualTo(2);
		assertThat(service.findOpenRound(OWNER).orElseThrow().myVotesLeft()).isZero();
		assertThat(service.findOpenRound(null).orElseThrow().myVotesLeft()).isNull();
		assertThat(service.findOpenRound(null).orElseThrow().voteLimit()).isEqualTo(3);
	}

	// ---------------- 재평가 · 삭제 ----------------

	@Test
	void retry_rejectsNonOwner() {
		when(artworkMapper.findById(5L)).thenReturn(artwork(5L, ArtworkStatus.FAILED, OWNER));

		assertThatThrownBy(() -> service.retry(5L, OTHER, 3))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(GlobalErrorCode.FORBIDDEN);
	}

	@Test
	void retry_rejectsScoredArtwork() {
		when(artworkMapper.findById(5L)).thenReturn(artwork(5L, ArtworkStatus.SCORED, OWNER));

		assertThatThrownBy(() -> service.retry(5L, OWNER, 3))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(ArtworkErrorCode.ARTWORK_NOT_FAILED);
	}

	@Test
	void retry_rejectsWhenAttemptsExhausted() {
		ArtworkRow row = artwork(5L, ArtworkStatus.FAILED, OWNER);
		row.setAttemptCnt(3);
		when(artworkMapper.findById(5L)).thenReturn(row);

		assertThatThrownBy(() -> service.retry(5L, OWNER, 3))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(ArtworkErrorCode.ARTWORK_RETRY_EXHAUSTED);

		verify(artworkMapper, never()).markPendingAgain(anyLong());
	}

	@Test
	void retry_movesFailedBackToPending() {
		ArtworkRow row = artwork(5L, ArtworkStatus.FAILED, OWNER);
		row.setAttemptCnt(1);
		when(artworkMapper.findById(5L)).thenReturn(row);

		service.retry(5L, OWNER, 3);

		verify(artworkMapper).markPendingAgain(5L);
	}

	@Test
	void delete_rejectsNonOwner() {
		when(artworkMapper.findById(5L)).thenReturn(artwork(5L, ArtworkStatus.SCORED, OWNER));

		assertThatThrownBy(() -> service.delete(5L, OTHER))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(GlobalErrorCode.FORBIDDEN);

		verify(artworkMapper, never()).deleteById(anyLong());
	}

	// ---------------- fixtures ----------------

	private static int anyInt() {
		return org.mockito.ArgumentMatchers.anyInt();
	}

	private static ArtworkRoundRow round() {
		ArtworkRoundRow row = new ArtworkRoundRow();
		row.setId(1L);
		row.setTheme("고양이");
		row.setThemePrompt("고양이를 얼마나 닮았는지 채점하라.");
		row.setStartsAt(OffsetDateTime.now().minusDays(1));
		row.setEndsAt(OffsetDateTime.now().plusDays(6));
		row.setVoteLimit(3);
		row.setAiWeight(5);
		return row;
	}

	private static ArtworkRow artwork(long id, ArtworkStatus status, String email) {
		ArtworkRow row = new ArtworkRow();
		row.setId(id);
		row.setRoundId(1L);
		row.setEmail(email);
		row.setTitle("밤산책");
		row.setStatus(status.name());
		row.setCreatedAt(OffsetDateTime.now());
		return row;
	}

	private static ArtworkPointRow point(long artworkId, int position, long musicId, double x, double y) {
		ArtworkPointRow row = new ArtworkPointRow(position, musicId, x, y);
		row.setArtworkId(artworkId);
		return row;
	}

	private static ArtworkSummaryRow summaryRow(long id) {
		ArtworkSummaryRow row = new ArtworkSummaryRow();
		row.setId(id);
		row.setTitle("밤산책");
		row.setEmail(OWNER);
		row.setStatus(ArtworkStatus.SCORED.name());
		row.setScore(80);
		row.setCreatedAt(OffsetDateTime.now());
		return row;
	}

	private static PlaylistDetailResponse playlistWith(Long... musicIds) {
		List<MusicDetail> musics = java.util.Arrays.stream(musicIds)
				.map(id -> new MusicDetail(
						id, null, "곡" + id, "아티스트", null, 200, null, null, null, null, null, null, null, null))
				.toList();
		return new PlaylistDetailResponse(1L, "밤산책", musics.size(), 0, 0, false, musics);
	}
}
