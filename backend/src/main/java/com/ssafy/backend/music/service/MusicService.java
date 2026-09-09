package com.ssafy.backend.music.service;

import java.util.Optional;

import org.springframework.stereotype.Service;

import com.ssafy.backend.music.dto.MajorResponse;
import com.ssafy.backend.music.dto.MusicSummary;
import com.ssafy.backend.music.dto.PageResponse;
import com.ssafy.backend.music.search.MusicSearchReader;

@Service
public class MusicService {

	/** 페이지 크기 서버 고정 (정본 §0.3). */
	private static final int PAGE_SIZE = 10;

	private final Optional<MusicSearchReader> searchReader;

	// ponytail: 검색 어댑터(BE4, B-D)가 아직 없어 Optional 주입. 어댑터 빈이 올라오면 자동 연결된다.
	public MusicService(Optional<MusicSearchReader> searchReader) {
		this.searchReader = searchReader;
	}

	/**
	 * 대표곡 조회 (정본 §3.4). level에 따라 사용하는 PC 축 개수가 달라진다.
	 *
	 * ponytail: 대표곡 KNN/거리 산정은 BE4 검색 인터페이스 대기 중. 인터페이스 확정 시 여기서 호출한다.
	 * 거리 척도 baseline = v2.1-pca16.
	 */
	public MajorResponse getMajor(int level, Double[] center) {
		throw new UnsupportedOperationException("music/major: BE4 검색 인터페이스 대기 중");
	}

	/**
	 * 노래 검색 (정본 §3.1). query 부분일치(대소문자 무시), youtubeCnt DESC·id ASC, 페이지 크기 10 고정.
	 * 매칭·정렬 실행은 BE4 조회 port에 위임하고, 여기서는 조건 전달과 응답 조립만 한다.
	 */
	public PageResponse<MusicSummary> search(String query, int page) {
		MusicSearchReader reader = searchReader.orElseThrow(
				() -> new UnsupportedOperationException("music/search: BE4 검색 어댑터 대기 중 (B-D)"));
		MusicSearchReader.PageResult result = reader.search(query.trim(), page, PAGE_SIZE);
		long total = result.totalElements();
		int totalPages = (int) ((total + PAGE_SIZE - 1) / PAGE_SIZE);
		boolean hasNext = (long) (page + 1) * PAGE_SIZE < total;
		return new PageResponse<>(result.content(), page, PAGE_SIZE, total, totalPages, hasNext);
	}
}
