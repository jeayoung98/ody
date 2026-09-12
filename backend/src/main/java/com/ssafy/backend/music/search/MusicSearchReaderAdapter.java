package com.ssafy.backend.music.search;

import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.mapping;
import static java.util.stream.Collectors.toList;

import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.stereotype.Repository;

import com.ssafy.backend.music.dto.MusicGenreRow;
import com.ssafy.backend.music.dto.MusicSearchRow;
import com.ssafy.backend.music.YoutubeSearchUrl;
import com.ssafy.backend.music.dto.MusicSummary;
import com.ssafy.backend.music.mapper.MusicSearchMapper;

/**
 * {@link MusicSearchReader} 의 MyBatis 어댑터 (정본 §3.1, 헌법 X: BE2 계약 / 실행 분리).
 *
 * 매칭·정렬·페이징은 SQL 이 하고, 여기서는 ILIKE 패턴 조립과 장르 합치기만 한다.
 * 좌표는 SELECT 가 펼쳐 준 pc1~pc16 을 그대로 옮긴다 — 재계산·재투영 없음(FR-006).
 */
@Repository
public class MusicSearchReaderAdapter implements MusicSearchReader {

	private final MusicSearchMapper mapper;

	public MusicSearchReaderAdapter(MusicSearchMapper mapper) {
		this.mapper = mapper;
	}

	@Override
	public PageResult search(String query, int page, int size) {
		String pattern = "%" + escapeLike(query) + "%";
		String lowered = query.toLowerCase(Locale.ROOT);
		String prefix = escapeLike(lowered) + "%";
		long offset = (long) page * size;

		// 매칭이 하나도 없으면 findPage 를 아예 돌리지 않는다. 단순한 최적화가 아니라
		// 관련성 질의가 5단계라, 매칭 0건일 때 각 단계가 조기 종료에 실패해 5배로 느려지는 것을 막는다.
		// ponytail: lower(title)·lower(artist) 색인이 붙으면 이 방패는 필요 없다 (S15P21A405-255).
		//
		// size+1 건을 떠서 초과분이 있었는지로 hasNext 를 판단한다. 총 건수를 세지 않는 이유는
		// PageResult 주석 참고 — 세는 질의 하나가 응답 시간의 ~7초였다.
		List<MusicSearchRow> rows = mapper.existsMatch(pattern)
				? mapper.findPage(lowered, prefix, pattern, offset + size + 1, size + 1, offset)
				: List.of();
		boolean hasNext = rows.size() > size;
		if (hasNext) {
			rows = rows.subList(0, size);
		}
		if (rows.isEmpty()) {
			// 매칭 0건이거나 page 가 마지막 페이지를 넘었다. 오류가 아니라 빈 목록이다(FR-002).
			return new PageResult(List.of(), false);
		}

		// 페이지에 실린 곡들의 장르를 한 번에 읽어 곡별로 묶는다(N+1 회피).
		Map<Long, List<String>> genres =
				mapper.findGenresByMusicIds(rows.stream().map(MusicSearchRow::getId).toList()).stream()
						.collect(groupingBy(MusicGenreRow::getMusicId,
								mapping(MusicGenreRow::getName, toList())));

		return new PageResult(rows.stream()
				.map(row -> new MusicSummary(
						row.getId(),
						row.getTitle(),
						row.getArtist(),
						row.getAlbum(),
						genres.getOrDefault(row.getId(), List.of()),
						YoutubeSearchUrl.of(row.getArtist(), row.getTitle()),
						row.toLocation()))
				.toList(), hasNext);
	}

	/**
	 * 검색어 안의 LIKE 와일드카드를 무력화한다. 이스케이프하지 않으면 "%" 한 글자가 전곡과 매칭된다.
	 * XML 쪽 ESCAPE 와 짝이다.
	 */
	private static String escapeLike(String query) {
		return query.replace("\\", "\\\\")
				.replace("%", "\\%")
				.replace("_", "\\_");
	}
}
