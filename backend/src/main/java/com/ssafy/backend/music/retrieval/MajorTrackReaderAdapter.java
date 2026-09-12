package com.ssafy.backend.music.retrieval;

import java.util.List;

import org.springframework.stereotype.Repository;

import com.ssafy.backend.music.dto.MapPoint;
import com.ssafy.backend.music.dto.MapPointRow;
import com.ssafy.backend.music.mapper.MajorTrackMapper;

/**
 * {@link MajorTrackReader} 의 MyBatis 어댑터 (T016, 헌법 X: BE2 계약 / 실행 분리).
 *
 * 서버는 상주 집합을 공간적으로 고르게 돌려줄 뿐 인기순 선별을 하지 않는다(D16).
 * 좌표는 SELECT 가 펼쳐 준 pc1~pc16 을 그대로 옮긴다 — 재계산·재투영 없음(FR-007).
 */
@Repository
public class MajorTrackReaderAdapter implements MajorTrackReader {

	/**
	 * FE 통보 대기 중인 잠정 장르 인덱스. <b>교체 지점은 {@link #genreIdOf} 한 곳뿐이다.</b>
	 *
	 * <p>FE 규약은 이미 구현돼 있다 — {@code frontend/src/constants/map.ts} 의 {@code GENRE_NAMES}
	 * 10종이고 {@code genreId} 는 그 배열의 인덱스다. 그런데 DB {@code genre} 는 멜론 대분류 29행이라
	 * 체계가 다르고(멜론은 록/메탈을 한 코드로 묶고, FE 에는 발라드·댄스·트로트·OST 가 없다),
	 * 무장르용 색도 없다. 장르 보유 곡은 66,036개로 전체의 1.0% 라 지도의 99%가 무장르다.
	 * 29→10 은 손실 있는 제품 결정이라 임의로 정하지 않는다(헌법 IX).
	 *
	 * <p>ponytail: 매핑이 오면 {@link #genreIdOf} 본문만 바꾸고, XML 의 {@code findLayerOneSample}·
	 * {@code findInAccumulatedBoxes} 에 {@code music_genre} 조인을 더한 뒤 {@link MapPointRow} 에
	 * 장르 필드를 추가한다. 그 전까지 조인하지 않는 편이 map_sample 의 조인 절감 이점을 덜 깎는다.
	 */
	private static final int GENRE_ID_PENDING_FE_MAPPING = 0;

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
				? mapper.findLayerOneSample()
				: mapper.findInAccumulatedBoxes(checkAxes(query.accumulated()), query.limit());
		return rows.stream().map(MajorTrackReaderAdapter::toMapPoint).toList();
	}

	private static MapPoint toMapPoint(MapPointRow row) {
		return new MapPoint(
				row.getMusicId(),
				row.toPcList(),
				genreIdOf(row),
				UNIFORM_WEIGHT,
				row.getTitle(),
				row.getArtist(),
				row.getYoutubeUrl() != null);
	}

	/** 장르 인덱스를 정하는 유일한 지점. FE 매핑이 오면 여기만 바꾼다. */
	private static int genreIdOf(MapPointRow row) {
		return GENRE_ID_PENDING_FE_MAPPING;
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
