package com.ssafy.backend.music.detail;

import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.mapping;
import static java.util.stream.Collectors.toList;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Repository;

import com.ssafy.backend.music.YoutubeSearchUrl;
import com.ssafy.backend.music.dto.Location;
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
 *
 * videoId 는 DB 에 있는 값만 그대로 내려준다. 외부 videoid API 실시간 조회(S15P21A405-312) 는
 * 이 어댑터를 공유하는 상세·주변탐색·플레이리스트·여정 모두를 한꺼번에 느리게 만들어 걷어냈다
 * (S15P21A405-322) — 곡 상세(/api/music/detail)만 {@code MusicService} 가 직접 호출해 유지한다.
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
		return Optional.of(toDetail(row, genres));
	}

	@Override
	public Map<Long, Location> findLocationsByIds(List<Long> ids) {
		if (ids.isEmpty()) {
			return Map.of();
		}
		Map<Long, Location> locations = new LinkedHashMap<>();
		for (MusicDetailRow row : mapper.findLocationsByIds(ids)) {
			locations.put(row.getId(), row.toLocation());
		}
		// 없는 곡·좌표 없는 곡은 키가 없다. 0 으로 채우지 않는다 — 호출자가 404 를 낸다.
		return locations;
	}

	@Override
	public List<MusicDetail> findDetailsByIds(List<Long> ids) {
		if (ids.isEmpty()) {
			return List.of();
		}
		List<MusicDetailRow> rows = mapper.findByIds(ids);
		Map<Long, List<String>> genres = findGenres(rows.stream().map(MusicDetailRow::getId).toList());
		// 순서는 보장하지 않는다 — 호출자가 id 키로 재조립한다.
		return rows.stream()
				.map(row -> toDetail(row, genres.getOrDefault(row.getId(), List.of())))
				.toList();
	}

	private static MusicDetail toDetail(MusicDetailRow row, List<String> genres) {
		return new MusicDetail(
				row.getId(),
				row.getMbid(),
				row.getTitle(),
				row.getArtist(),
				row.getBpm(),
				row.getDuration(),
				row.getAlbum(),
				row.getReleaseYear(),
				genres,
				YoutubeSearchUrl.of(row.getArtist(), row.getTitle()),
				row.getVideoId(),
				row.toLocation(),
				row.getPlayCnt(),
				row.getYoutubeCnt());
	}

	@Override
	public List<MusicSummary> findSummariesByIds(List<Long> ids) {
		if (ids.isEmpty()) {
			return List.of();               // IN () 는 문법 오류
		}
		List<MusicDetailRow> rows = mapper.findByIds(ids);
		Map<Long, List<String>> genres = findGenres(rows.stream().map(MusicDetailRow::getId).toList());
		return rows.stream()
				.map(row -> new MusicSummary(
						row.getId(),
						row.getTitle(),
						row.getArtist(),
						row.getAlbum(),
						genres.getOrDefault(row.getId(), List.of()),
						YoutubeSearchUrl.of(row.getArtist(), row.getTitle()),
						row.getVideoId(),
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
