package com.ssafy.backend.music.service;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.MusicErrorCode;
import com.ssafy.backend.music.detail.MusicDetailReader;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.music.dto.MusicDetailResponse;
import com.ssafy.backend.music.dto.NeighborTrack;

@Service
public class MusicService {

	/** 주변곡 개수 고정 (정본 §3.2). */
	private static final int NEIGHBOR_COUNT = 10;

	private final Optional<MusicDetailReader> detailReader;

	// ponytail: 조회 어댑터(BE4, B-D)가 아직 없어 Optional 주입. 어댑터 빈이 올라오면 자동 연결된다.
	public MusicService(Optional<MusicDetailReader> detailReader) {
		this.detailReader = detailReader;
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
