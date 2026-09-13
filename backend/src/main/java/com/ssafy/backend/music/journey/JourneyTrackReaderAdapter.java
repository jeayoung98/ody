package com.ssafy.backend.music.journey;

import static com.ssafy.backend.music.YoutubeSearchUrl.VIDEO_ID_NOT_LOADED;
import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.mapping;
import static java.util.stream.Collectors.toList;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.backend.music.YoutubeSearchUrl;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.music.dto.MusicDetailRow;
import com.ssafy.backend.music.dto.MusicGenreRow;
import com.ssafy.backend.music.mapper.MusicDetailMapper;

/**
 * {@link JourneyTrackReader} 의 MyBatis 어댑터 (T045, 헌법 X: BE2 계약 / 실행 분리).
 *
 * <p>이 빈이 없으면 중간 정거장이 있는 <b>모든 여정 요청이 500 으로 떨어진다</b> —
 * {@code JourneyService.hydrate()} 가 port 를 {@code orElseThrow} 로 꺼내기 때문이다.
 * 산출 쪽(축·DP·층 조회)이 다 붙어도 응답 조립이 여기서 끊긴다.
 *
 * <p>port 계약대로 <b>순서를 보장하지 않고</b>, 없는 mbid 는 결과에서 뺀다. 순서 복원과 누락 판정은
 * 호출자 몫이다(FR-005, FR-014).
 *
 * <p>좌표는 저장된 값을 그대로 옮긴다 — 재계산·재투영 없음(FR-016).
 * 조회 전용이라 쓰기가 없다(FR-018).
 */
@Repository
public class JourneyTrackReaderAdapter implements JourneyTrackReader {

	private final MusicDetailMapper mapper;

	public JourneyTrackReaderAdapter(MusicDetailMapper mapper) {
		this.mapper = mapper;
	}

	/**
	 * 질의 2회로 끝낸다 — 곡 일괄 조회 1회 + 장르 일괄 조회 1회. 곡당 왕복을 돌면
	 * 정거장 20개에 40왕복이라 종단 예산을 넘긴다(SC-002).
	 */
	@Override
	@Transactional(readOnly = true)
	public List<MusicDetail> findDetailsByMbids(List<String> mbids) {
		if (mbids.isEmpty()) {
			return List.of();                   // IN () 는 문법 오류다
		}

		List<MusicDetailRow> rows = mapper.findByMbids(mbids);
		if (rows.isEmpty()) {
			return List.of();
		}

		Map<Long, List<String>> genres = mapper.findGenresByMusicIds(
						rows.stream().map(MusicDetailRow::getId).toList()).stream()
				.collect(groupingBy(MusicGenreRow::getMusicId, mapping(MusicGenreRow::getName, toList())));

		return rows.stream()
				.map(row -> new MusicDetail(
						row.getId(),
						row.getMbid(),
						row.getTitle(),
						row.getArtist(),
						row.getBpm(),
						row.getDuration(),
						row.getAlbum(),
						genres.getOrDefault(row.getId(), List.of()),
						YoutubeSearchUrl.of(row.getArtist(), row.getTitle()),
						VIDEO_ID_NOT_LOADED,
						row.toLocation(),
						row.getPlayCnt(),
						row.getYoutubeCnt()))
				.toList();
	}
}
