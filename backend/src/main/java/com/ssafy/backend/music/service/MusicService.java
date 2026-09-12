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
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.MusicErrorCode;
import com.ssafy.backend.music.detail.MusicDetailReader;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.music.dto.MusicDetailResponse;
import com.ssafy.backend.music.dto.NeighborTrack;

@Service
public class MusicService {
	/** 페이지 크기 서버 고정 (정본 §0.3). */
	private static final int PAGE_SIZE = 10;

	/** 주변곡 개수 고정 (정본 §3.2). */
	private static final int NEIGHBOR_COUNT = 10;

	/** 상주 집합 크기. 1000 이 규모 기준이다(D18) — 정확한 수는 강제하지 않는다. */
	private static final int RESIDENT_SET_SIZE = 1000;

	private final Optional<MusicSearchReader> searchReader;
	private final Optional<MusicDetailReader> detailReader;
	private final Optional<MajorTrackReader> majorReader;

	// ponytail: 어댑터가 아직 없는 port 는 Optional 주입. 빈이 올라오면 자동 연결된다.
	public MusicService(Optional<MusicSearchReader> searchReader, Optional<MusicDetailReader> detailReader,
			Optional<MajorTrackReader> majorReader) {
		this.searchReader = searchReader;
		this.detailReader = detailReader;
		this.majorReader = majorReader;
	}

	/**
	 * 레이어 상주 집합 조회 (D16·D18·D19). level n 의 평면은 PC(2n-1)·PC(2n) 이다.
	 *
	 * 서버는 공간적으로 고른 상주 집합만 돌려준다 — 인기순 대표 선별은 클라이언트가 화면 픽셀
	 * 격자에서 한다(D16). 격자는 줌에 따라 변해 서버가 적용할 수 없다.
	 * 전역 상위 k 를 먼저 자른 뒤 범위로 거르지 않는다(FR-013 MUST NOT).
	 *
	 * ponytail: 후보 0곡일 때 200 + 빈 배열을 돌려주는 것은 <b>B4 미확정 상태의 잠정 동작</b>이다.
	 * plan.md 는 'B4 확정 전 구현하지 않는다' 고 적었으나, 조회 자체를 막을 수는 없어 가장 조용한
	 * 기본값을 택했다. B4 가 정해지면 여기서 상태·본문을 바꾼다(빈 배열 + 200 을 계약으로 확정할 수도 있다).
	 */
	public MajorResponse getMajor(int level, List<LayerBox> accumulated) {
		MajorTrackReader reader = majorReader.orElseThrow(
				() -> new UnsupportedOperationException("music/major: 상주 집합 어댑터 대기 중"));
		return new MajorResponse(reader.findResidentSet(new MajorQuery(level, accumulated, RESIDENT_SET_SIZE)));
	}

	/**
	 * 노래 검색 (정본 §3.1). query 부분일치(대소문자 무시), 관련성 순, 페이지 크기 10 고정.
	 * 매칭·정렬 실행은 BE4 조회 port에 위임하고, 여기서는 조건 전달과 응답 조립만 한다.
	 */
	public PageResponse<MusicSummary> search(String query, int page) {
		MusicSearchReader reader = searchReader.orElseThrow(
				() -> new UnsupportedOperationException("music/search: BE4 검색 어댑터 대기 중 (B-D)"));
		MusicSearchReader.PageResult result = reader.search(query.trim(), page, PAGE_SIZE);
		return new PageResponse<>(result.content(), page, PAGE_SIZE, result.hasNext());
	}

	/**
	 * 노래 상세 + 주변곡 조회 (정본 §3.2).
	 * 없는 곡 → MUSIC_NOT_FOUND(404). 최근접 선정·정렬·자기 제외는 조회 port(어댑터) 책임.
	 */
	public MusicDetailResponse getDetail(long id) {
		MusicDetailReader reader = detailReader.orElseThrow(
				() -> new UnsupportedOperationException("music/detail: BE4 조회 어댑터 대기 중 (B-D)"));
		MusicDetail detail = reader.findDetail(id)
				.orElseThrow(() -> new CustomException(MusicErrorCode.MUSIC_NOT_FOUND));
		List<NeighborTrack> neighbors = reader.findNeighbors(id, NEIGHBOR_COUNT);
		return new MusicDetailResponse(detail, neighbors);
	}
}
