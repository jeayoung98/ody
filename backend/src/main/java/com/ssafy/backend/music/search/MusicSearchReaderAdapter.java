package com.ssafy.backend.music.search;

import java.util.List;
import java.util.Locale;

import org.springframework.stereotype.Repository;

import com.ssafy.backend.music.dto.MusicSearchRow;
import com.ssafy.backend.music.YoutubeSearchUrl;
import com.ssafy.backend.music.dto.MusicSummary;
import com.ssafy.backend.music.mapper.MusicSearchMapper;

/**
 * {@link MusicSearchReader} 의 MyBatis 어댑터 (정본 §3.1, 헌법 X: BE2 계약 / 실행 분리).
 *
 * 매칭·정렬·페이징은 SQL 이 하고, 여기서는 앞일치 패턴 조립만 한다.
 * 좌표는 SELECT 가 펼쳐 준 pc1~pc16 을 그대로 옮긴다 — 재계산·재투영 없음(FR-006).
 *
 * videoId 는 DB 에 있는 값만 그대로 내려준다. 외부 videoid API 실시간 조회(S15P21A405-312) 는
 * 검색 결과 최대 10건마다 순차 호출돼 응답이 느려져 걷어냈다(S15P21A405-321) — 곡 상세
 * ({@code MusicDetailReaderAdapter}) 는 1건만 조회하므로 그대로 유지한다.
 */
@Repository
public class MusicSearchReaderAdapter implements MusicSearchReader {

	private final MusicSearchMapper mapper;

	public MusicSearchReaderAdapter(MusicSearchMapper mapper) {
		this.mapper = mapper;
	}

	@Override
	public PageResult search(MusicSearchCondition condition, int page, int size) {
		long offset = (long) page * size;
		long cap = offset + size + 1;
		List<MusicSearchRow> rows;
		if (condition.isIntegrated()) {
			String lowered = lower(condition.query());
			rows = mapper.findPage(lowered, prefix(lowered), cap, size + 1, offset);
		} else {
			String artist = lower(condition.artist());
			String music = condition.music() == null ? null : lower(condition.music());
			rows = mapper.findFilteredPage(artist, prefix(artist), music,
					music == null ? null : prefix(music), cap, size + 1, offset);
		}

		// size+1 건을 떠서 초과분이 있었는지로 hasNext 를 판단한다. 총 건수를 세지 않는 이유는
		// PageResult 주석 참고 — 세는 질의 하나가 응답 시간의 ~7초였다.
		//
		// 0건을 먼저 걸러 주던 existsMatch 방패는 없앴다 (S15P21A405-298). 그건 부분일치 단계가
		// 0건일 때 풀스캔을 다섯 번 하는 것을 막으려던 것인데, 그 단계 자체가 사라졌다.
		// 남은 네 단계는 전부 색인 구간 조회라 매칭이 없어도 즉시 빈 결과로 끝난다.
		boolean hasNext = rows.size() > size;
		if (hasNext) {
			rows = rows.subList(0, size);
		}
		if (rows.isEmpty()) {
			// 매칭 0건이거나 page 가 마지막 페이지를 넘었다. 오류가 아니라 빈 목록이다(FR-002).
			return new PageResult(List.of(), false);
		}

		return new PageResult(rows.stream()
				.map(row -> new MusicSummary(
						row.getId(),
						row.getTitle(),
						row.getArtist(),
						row.getAlbum(),
						YoutubeSearchUrl.of(row.getArtist(), row.getTitle()),
						row.getVideoId(),
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

	private static String lower(String value) {
		return value.toLowerCase(Locale.ROOT);
	}

	private static String prefix(String value) {
		return escapeLike(value) + "%";
	}
}
