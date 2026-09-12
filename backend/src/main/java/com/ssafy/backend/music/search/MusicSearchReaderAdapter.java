package com.ssafy.backend.music.search;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.ibatis.session.SqlSession;
import org.springframework.stereotype.Repository;

import com.ssafy.backend.music.dto.MusicGenreRow;
import com.ssafy.backend.music.dto.MusicSearchRow;
import com.ssafy.backend.music.dto.MusicSummary;

/**
 * {@link MusicSearchReader} 의 MyBatis 어댑터 (정본 §3.1, 헌법 X: BE2 계약 / 실행 분리).
 *
 * 매칭·정렬·페이징은 SQL 이 하고, 여기서는 ILIKE 패턴 조립과 장르 합치기만 한다.
 * 좌표는 SELECT 가 펼쳐 준 pc1~pc16 을 그대로 옮긴다 — 재계산·재투영 없음(FR-006).
 */
@Repository
public class MusicSearchReaderAdapter implements MusicSearchReader {

	private final MusicSearchMapper mapper;

	public MusicSearchReaderAdapter(SqlSession sqlSession) {
		// 매퍼를 스프링 빈으로 두지 않는 이유는 MusicSearchMapper javadoc 참조.
		// 여기서 바인딩이 깨지면 컨텍스트 로딩 단계에서 바로 드러난다(BackendApplicationTests).
		this.mapper = sqlSession.getMapper(MusicSearchMapper.class);
	}

	@Override
	public PageResult search(String query, int page, int size) {
		String pattern = "%" + escapeLike(query) + "%";

		long total = mapper.countMatches(pattern);
		if (total == 0) {
			return new PageResult(List.of(), 0);
		}

		List<MusicSearchRow> rows = mapper.findPage(pattern, size, (long) page * size);
		if (rows.isEmpty()) {
			// page 가 총 페이지 수를 넘은 경우. 오류가 아니라 빈 목록이다(FR-002).
			return new PageResult(List.of(), total);
		}

		Map<Long, List<String>> genres = findGenres(rows);
		List<MusicSummary> content = new ArrayList<>(rows.size());
		for (MusicSearchRow row : rows) {
			content.add(new MusicSummary(
					row.getId(),
					row.getTitle(),
					row.getArtist(),
					row.getAlbum(),
					genres.getOrDefault(row.getId(), List.of()),
					row.getYoutubeUrl(),
					row.toLocation()));
		}
		return new PageResult(content, total);
	}

	/** 페이지에 실린 곡들의 장르를 한 번에 읽어 곡별로 묶는다(N+1 회피). */
	private Map<Long, List<String>> findGenres(List<MusicSearchRow> rows) {
		List<Long> ids = rows.stream().map(MusicSearchRow::getId).toList();
		Map<Long, List<String>> byMusicId = new HashMap<>();
		for (MusicGenreRow genreRow : mapper.findGenresByMusicIds(ids)) {
			byMusicId.computeIfAbsent(genreRow.getMusicId(), key -> new ArrayList<>()).add(genreRow.getName());
		}
		return byMusicId;
	}

	/**
	 * 검색어 안의 LIKE 와일드카드를 무력화한다. 이스케이프하지 않으면 "%" 한 글자가 전곡과 매칭된다.
	 * XML 쪽 ESCAPE '\' 와 짝이다.
	 */
	private static String escapeLike(String query) {
		return query.replace("\\", "\\\\")
				.replace("%", "\\%")
				.replace("_", "\\_");
	}
}
