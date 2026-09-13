package com.ssafy.backend.music.detail;

import static com.ssafy.backend.music.YoutubeSearchUrl.VIDEO_ID_NOT_LOADED;
import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.mapping;
import static java.util.stream.Collectors.toList;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Repository;

import com.ssafy.backend.music.YoutubeSearchUrl;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.music.dto.MusicDetailRow;
import com.ssafy.backend.music.dto.MusicGenreRow;
import com.ssafy.backend.music.dto.MusicSummary;
import com.ssafy.backend.music.mapper.MusicDetailMapper;

/**
 * {@link MusicDetailReader} 의 MyBatis 어댑터 (정본 §3.2, 헌법 X: BE2 계약 / 실행 분리).
 *
 * 좌표는 SELECT 가 펼쳐 준 pc1~pc16 을 그대로 옮긴다 — 재계산·재투영 없음(FR-006).
 * 거리 척도는 서빙 baseline(v2.1-pca16) 위의 L2({@code <->}, music_location_hnsw_idx 와 같은 연산자).
 */
@Repository
public class MusicDetailReaderAdapter implements MusicDetailReader {

	private final MusicDetailMapper mapper;

	public MusicDetailReaderAdapter(MusicDetailMapper mapper) {
		this.mapper = mapper;
	}

	@Override
	public Optional<MusicDetail> findDetail(long id) {
		MusicDetailRow row = mapper.findById(id);
		if (row == null) {
			return Optional.empty(); // 서비스가 MUSIC_NOT_FOUND(404) 로 바꾼다
		}
		List<String> genres = findGenres(List.of(id)).getOrDefault(id, List.of());
		return Optional.of(new MusicDetail(
				row.getId(),
				row.getMbid(),
				row.getTitle(),
				row.getArtist(),
				row.getBpm(),
				row.getDuration(),
				row.getAlbum(),
				genres,
				YoutubeSearchUrl.of(row.getArtist(), row.getTitle()),
				VIDEO_ID_NOT_LOADED,
				row.toLocation(),
				row.getPlayCnt(),
				row.getYoutubeCnt()));
	}

	@Override
	public List<MusicSummary> findSummariesByMbids(List<String> mbids) {
		if (mbids.isEmpty()) {
			return List.of();               // IN () 는 문법 오류
		}
		List<MusicDetailRow> rows = mapper.findByMbids(mbids);
		Map<Long, List<String>> genres = findGenres(rows.stream().map(MusicDetailRow::getId).toList());
		return rows.stream()
				.map(row -> new MusicSummary(
						row.getId(),
						row.getTitle(),
						row.getArtist(),
						row.getAlbum(),
						genres.getOrDefault(row.getId(), List.of()),
						YoutubeSearchUrl.of(row.getArtist(), row.getTitle()),
						VIDEO_ID_NOT_LOADED,
						row.toLocation()))
				.toList();
	}

	/** 곡들의 장르를 한 번에 읽어 곡별로 묶는다(N+1 회피). 빈 목록이면 질의하지 않는다(IN () 는 문법 오류). */
	private Map<Long, List<String>> findGenres(List<Long> musicIds) {
		if (musicIds.isEmpty()) {
			return Map.of();
		}
		return mapper.findGenresByMusicIds(musicIds).stream()
				.collect(groupingBy(MusicGenreRow::getMusicId, mapping(MusicGenreRow::getName, toList())));
	}
}
