package com.ssafy.backend.music.detail;

import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.mapping;
import static java.util.stream.Collectors.toList;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Repository;

import com.ssafy.backend.music.YoutubeSearchUrl;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.music.dto.MusicDetailRow;
import com.ssafy.backend.music.dto.MusicGenreRow;
import com.ssafy.backend.music.dto.MusicSummary;
import com.ssafy.backend.music.dto.NeighborTrack;
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
				row.toLocation(),
				row.getPlayCnt(),
				row.getYoutubeCnt()));
	}

	@Override
	public List<NeighborTrack> findNeighbors(long id, int k) {
		// 함정 회피: 좌표를 먼저 읽어 바인드 파라미터로 넘긴다. 서브쿼리로 넘기면 recall 0.0000.
		String qvec = mapper.findLocationText(id);
		if (qvec == null) {
			return List.of(); // 없는 곡이거나 좌표가 없는 곡
		}

		List<MusicDetailRow> rows = mapper.findNearest(id, qvec, k);
		Map<Long, List<String>> genres = findGenres(rows.stream().map(MusicDetailRow::getId).toList());
		return rows.stream()
				// SQL 은 거리 하나로만 정렬한다(HNSW 인덱스 순서 유지). 동률 id 오름차순은 여기서 준다.
				.sorted(Comparator.comparingDouble(MusicDetailRow::getDistance)
						.thenComparingLong(MusicDetailRow::getId))
				.map(row -> new NeighborTrack(
						new MusicSummary(
								row.getId(),
								row.getTitle(),
								row.getArtist(),
								row.getAlbum(),
								genres.getOrDefault(row.getId(), List.of()),
								YoutubeSearchUrl.of(row.getArtist(), row.getTitle()),
								row.toLocation()),
						row.getDistance()))
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
