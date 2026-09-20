package com.ssafy.backend.music.retrieval;

import static com.ssafy.backend.music.YoutubeSearchUrl.VIDEO_ID_NOT_LOADED;
import java.util.List;

import org.springframework.stereotype.Repository;

import com.ssafy.backend.music.YoutubeSearchUrl;
import com.ssafy.backend.music.dto.MapPoint;
import com.ssafy.backend.music.dto.MapPointRow;
import com.ssafy.backend.music.mapper.MajorTrackMapper;

/**
 * {@link MajorTrackReader} 의 MyBatis 어댑터 (T016, 헌법 X: BE2 계약 / 실행 분리).
 *
 * 서버는 상주 집합을 공간적으로 고르게 돌려줄 뿐 인기순 선별을 하지 않는다(D16).
 * SELECT가 펼친 pc1~pc16은 재계산·재투영하지 않고 MapPoint 응답 경계에서만 3자리로 반올림한다(FR-007·FR-016).
 */
@Repository
public class MajorTrackReaderAdapter implements MajorTrackReader {

	/**
	 * 무장르 색 인덱스. <b>교체 지점은 {@link #genreIdOf} 한 곳뿐이다.</b>
	 *
	 * <p>FE {@code constants/map.ts} 의 {@code NO_GENRE_ID} 와 같은 값이다 —
	 * {@code GENRE_NAMES}·{@code GENRE_COLORS} 는 11칸이고 마지막(10)이 무장르용 회청색이다
	 * (2026-09-12 origin/frontend/dev 확인). 0 을 보내면 앰비언트 청록이라 지도가 한 색이 된다.
	 *
	 * <p>DB 의 {@code genre}·{@code music_genre} 테이블은 삭제됐다(S15P21A405-475). 장르 색을 칠할
	 * 원천이 없으므로 전 곡을 무장르로 내린다 — 지도는 깨지지 않는다(FE 확인, S15P21A405-240).
	 * 새 장르 원천이 생기면 {@link #genreIdOf} 본문을 바꾸고 {@link MapPointRow} 에 장르 필드를 더한다.
	 */
	private static final int GENRE_ID_NO_GENRE = 10;

	/**
	 * 균일 가중치 (D17). 인기 지표가 없어 값으로 순위를 매길 수 없다 —
	 * {@code play_cnt}·{@code youtube_cnt} 는 662만 행 전부 0 이다(data 스펙 18).
	 * 계약 예시({@code contracts/music-major.md})의 값과 같다.
	 */
	private static final int UNIFORM_WEIGHT = 0;

	/** PC 축 번호 상한. {@code location vector(16)} 이므로 16 을 넘는 첨자는 SQL 이 성립하지 않는다. */
	private static final int MAX_AXIS = MapPoint.PC_DIMS;

	private final MajorTrackMapper mapper;

	public MajorTrackReaderAdapter(MajorTrackMapper mapper) {
		this.mapper = mapper;
	}

	@Override
	public List<MapPoint> findResidentSet(MajorQuery query) {
		List<MapPointRow> rows = query.isTopLevel()
				? mapper.findLayerOneSample(query.limit())
				: mapper.findInAccumulatedBoxes(checkAxes(query.accumulated()), query.limit());
		return rows.stream().map(MajorTrackReaderAdapter::toMapPoint).toList();
	}

	private static MapPoint toMapPoint(MapPointRow row) {
		// music.youtube_url 은 662만 행 전부 NULL 이라 읽지 않는다. map_sample 이 들고 있는
		// title·artist 로 검색 URL 을 만든다 (D12) — 조인이 없어 0.4 ms 이점이 유지된다.
		boolean playable = YoutubeSearchUrl.of(row.getArtist(), row.getTitle()) != null;
		return new MapPoint(
				row.getMusicId(),
				row.toPcList(),
				genreIdOf(row),
				UNIFORM_WEIGHT,
				row.getTitle(),
				row.getArtist(),
				VIDEO_ID_NOT_LOADED,
				playable);
	}

	/** 장르 인덱스를 정하는 유일한 지점. FE 매핑이 오면 여기만 바꾼다. */
	private static int genreIdOf(MapPointRow row) {
		return GENRE_ID_NO_GENRE;
	}

	/**
	 * 축 번호가 pc1~pc16 안인지 본다. XML 이 축 첨자를 {@code ${}} 로 넣기 때문에
	 * (바인드 파라미터를 쓰면 표현식 GiST 를 타지 못한다) SQL 에 닿기 전에 여기서 막는다.
	 */
	private static List<LayerBox> checkAxes(List<LayerBox> boxes) {
		for (LayerBox box : boxes) {
			if (box.axisY() > MAX_AXIS) {
				throw new IllegalArgumentException(
						"layer %d 는 pc%d 축을 요구하는데 좌표는 %d 차원이다".formatted(box.layer(), box.axisY(), MAX_AXIS));
			}
		}
		return boxes;
	}
}
