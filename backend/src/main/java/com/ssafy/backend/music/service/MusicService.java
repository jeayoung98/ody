package com.ssafy.backend.music.service;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.ssafy.backend.music.dto.MajorResponse;
import com.ssafy.backend.music.retrieval.LayerBox;
import com.ssafy.backend.music.retrieval.MajorQuery;
import com.ssafy.backend.music.retrieval.MajorTrackReader;
import com.ssafy.backend.music.dto.MusicSummary;
import com.ssafy.backend.music.dto.PageResponse;
import com.ssafy.backend.music.search.MusicSearchReader;
import com.ssafy.backend.music.search.MusicSearchCondition;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.MusicErrorCode;
import com.ssafy.backend.music.detail.MusicDetailReader;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.music.dto.MusicDetailResponse;
import com.ssafy.backend.music.dto.VideoIdBatchResponse;
import com.ssafy.backend.music.dto.VideoIdItem;
import com.ssafy.backend.music.videoid.VideoIdEnricher;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class MusicService {
	/** 페이지 크기 서버 고정 (정본 §0.3). */
	private static final int PAGE_SIZE = 10;

	/** 주변곡 개수 고정 (정본 §3.2). */
	private static final int NEIGHBOR_COUNT = 10;
	private static final int DEFAULT_RESIDENT_SET_SIZE = 1000;

	private final Optional<MusicSearchReader> searchReader;
	private final Optional<MusicDetailReader> detailReader;
	private final NearbyService nearbyService;
	private final Optional<MajorTrackReader> majorReader;
	private final VideoIdEnricher videoIdEnricher;

	// ponytail: 어댑터가 아직 없는 port 는 Optional 주입. 빈이 올라오면 자동 연결된다.
	public MusicService(Optional<MusicSearchReader> searchReader, Optional<MusicDetailReader> detailReader,
			Optional<MajorTrackReader> majorReader, NearbyService nearbyService, VideoIdEnricher videoIdEnricher) {
		this.searchReader = searchReader;
		this.detailReader = detailReader;
		this.majorReader = majorReader;
		this.nearbyService = nearbyService;
		this.videoIdEnricher = videoIdEnricher;
	}

	/**
	 * 레이어 상주 집합 조회 (D16·D18·D19). level n 의 평면은 PC(2n-1)·PC(2n) 이다.
	 *
	 * 서버는 공간적으로 고른 상주 집합만 돌려준다 — 인기순 대표 선별은 클라이언트가 화면 픽셀
	 * 격자에서 한다(D16). 격자는 줌에 따라 변해 서버가 적용할 수 없다.
	 * 전역 상위 k 를 먼저 자른 뒤 범위로 거르지 않는다(FR-013 MUST NOT).
	 *
	 * size를 생략하면 2레이어 이상은 기존 1000곡 상한을 유지한다. 1레이어는 기존 정적 표본 전체를
	 * 유지하고, size를 명시한 경우에만 모든 레이어에서 같은 상한을 적용한다(A-30).
	 */
	public MajorResponse getMajor(int level, List<LayerBox> accumulated, Integer requestedSize) {
		MajorTrackReader reader = majorReader.orElseThrow(
				() -> new UnsupportedOperationException("music/major: 상주 집합 어댑터 대기 중"));
		int limit = requestedSize != null
				? requestedSize
				: level == 1 ? Integer.MAX_VALUE : DEFAULT_RESIDENT_SET_SIZE;
		MajorResponse response = new MajorResponse(
				reader.findResidentSet(new MajorQuery(level, accumulated, limit)));
		log.info("[Music] 대표곡 조회 완료 level={} requestedSize={} count={}",
				level, requestedSize, response.content().size());
		return response;
	}

	/**
	 * 음악 검색 (정본 §3.1). 통합 또는 아티스트 필터 앞일치, 관련성 순, 페이지 크기 10 고정.
	 * 매칭·정렬 실행은 BE4 조회 port에 위임하고, 여기서는 조건 전달과 응답 조립만 한다.
	 */
	public PageResponse<MusicSummary> search(MusicSearchCondition condition, int page) {
		MusicSearchReader reader = searchReader.orElseThrow(
				() -> new UnsupportedOperationException("music/search: BE4 검색 어댑터 대기 중 (B-D)"));
		MusicSearchReader.PageResult result = reader.search(condition, page, PAGE_SIZE);
		log.info("[Music] 검색 완료 mode={} page={} count={}", condition.mode(), page, result.content().size());
		return new PageResponse<>(result.content(), page, PAGE_SIZE, result.hasNext());
	}

	/**
	 * 노래 상세 + 주변곡 조회 (정본 §3.2).
	 * 없는 곡 → MUSIC_NOT_FOUND(404). 최근접 선정·정렬·자기 제외는 조회 port(어댑터) 책임.
	 *
	 * <p>videoId 가 DB 에 없으면 외부 videoid API 로 실시간 조회해 채운다(S15P21A405-312, 프로토타입).
	 * <b>중심곡만</b> 이 조회를 한다 — 이웃곡까지 하면 최대 10건을 순차 호출해 느려지므로
	 * 걷어냈다(S15P21A405-322). 검색·주변탐색·경로탐색도 같은 이유로 이미 걷어냈다
	 * (S15P21A405-321, S15P21A405-322).
	 */
	public MusicDetailResponse getDetail(long id) {
		MusicDetailReader reader = detailReader.orElseThrow(
				() -> new UnsupportedOperationException("music/detail: BE4 조회 어댑터 대기 중 (B-D)"));
		MusicDetail detail = reader.findDetail(id)
				.orElseThrow(() -> new CustomException(MusicErrorCode.MUSIC_NOT_FOUND));
		// 이웃 선정은 주변 탐색(005)과 같은 코드 경로를 지나간다 — 규칙이 두 벌이 되면
		// 같은 곡에 곡 상세와 주변 탐색 뷰가 다른 목록을 준다(005 FR-023, SC-006).
		NearbyService.NeighborResult result = nearbyService.neighborsOf(detail);

		MusicDetail enrichedDetail = withVideoId(detail,
				videoIdEnricher.resolve(detail.id(), detail.artist(), detail.title(), detail.album(),
						detail.videoId(), detail.duration()));

		log.info("[Music] 상세 조회 완료 title={}, artist={}, musicId={}, videoId={}, neighbors={}", enrichedDetail.title(), enrichedDetail.artist(), id, enrichedDetail.videoId(), result.neighbors().size());
		return new MusicDetailResponse(enrichedDetail, result.neighbors(), result.lowSimilarity());
	}

	private static MusicDetail withVideoId(MusicDetail detail, String videoId) {
		return new MusicDetail(detail.id(), detail.mbid(), detail.title(), detail.artist(), detail.bpm(),
				detail.duration(), detail.album(), detail.albumMbid(), detail.releaseYear(), detail.youtubeUrl(), videoId,
				detail.location(), detail.playCnt(), detail.youtubeCnt());
	}

	/**
	 * musicId 목록으로 videoId 를 일괄 조회한다 (S15P21A405-322, 프로토타입).
	 * DB 에 이미 있으면 그대로, 없으면 외부 videoid API 를 호출해 채우고 저장한다.
	 * 요청한 musicId 중 없는 곡은 결과에서 빠진다(예외 아님) — 다른 일괄 조회들과 같은 관례.
	 */
	public VideoIdBatchResponse getVideoIds(List<Long> musicIds) {
		MusicDetailReader reader = detailReader.orElseThrow(
				() -> new UnsupportedOperationException("music/videoid: BE4 조회 어댑터 대기 중 (B-D)"));
		// findSummariesByIds(MusicSummary) 대신 findDetailsByIds(MusicDetail) 를 쓴다 — duration 이
		// 필요해서다(S15P21A405-407). MusicSummary 에 duration 을 추가하면 docs/api-spec.md §0.6 계약과
		// 어긋나고 search/상세-이웃/경로탐색 응답에도 새 필드가 생기지만, 이 응답(VideoIdItem)은
		// musicId/videoId 만 내보내므로 내부 조회 타입만 바꿔도 API 계약은 그대로다.
		List<MusicDetail> details = reader.findDetailsByIds(musicIds);

		List<VideoIdItem> items = details.stream()
				.map(detail -> new VideoIdItem(detail.id(),
						videoIdEnricher.resolve(detail.id(), detail.artist(), detail.title(), detail.album(),
								detail.videoId(), detail.duration())))
				.toList();

		log.info("[VideoId] 일괄 조회 완료 요청={} 응답={}", musicIds.size(), items.size());
		return new VideoIdBatchResponse(items);
	}
}
