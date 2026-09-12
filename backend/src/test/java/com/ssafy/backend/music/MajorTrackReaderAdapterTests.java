package com.ssafy.backend.music;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.music.YoutubeSearchUrl;
import com.ssafy.backend.music.dto.MapPoint;
import com.ssafy.backend.music.dto.MapPointRow;
import com.ssafy.backend.music.retrieval.LayerBox;
import com.ssafy.backend.music.retrieval.MajorQuery;
import com.ssafy.backend.music.mapper.MajorTrackMapper;
import com.ssafy.backend.music.retrieval.MajorTrackReaderAdapter;

/**
 * 상주 집합 어댑터 단위 테스트 (매퍼 mock). SQL 자체는 실 DB(T017) 대상이고,
 * 여기서는 어댑터가 지는 책임 — 레벨별 질의 분기·좌표 이관·잠정값·축 상한 — 만 본다.
 */
class MajorTrackReaderAdapterTests {

	private static final double[] PCS = { 0.11, -0.22, 0.33, -0.44, 0.55, -0.66, 0.77, -0.88,
			0.99, -1.10, 1.21, -1.32, 1.43, -1.54, 1.65, -1.76 };

	private final MajorTrackMapper mapper = mock(MajorTrackMapper.class);
	private final MajorTrackReaderAdapter adapter = new MajorTrackReaderAdapter(mapper);

	private static MapPointRow row(long musicId, String youtubeUrl) {
		MapPointRow r = new MapPointRow();
		r.setMusicId(musicId);
		r.setTitle("t" + musicId);
		r.setArtist("a" + musicId);
		r.setYoutubeUrl(youtubeUrl);
		r.setPc1(PCS[0]);
		r.setPc2(PCS[1]);
		r.setPc16(PCS[15]);
		return r;
	}

	@Test
	void level1_readsPrecomputedSample_notTheLiveScan() {
		// 전역 실시간 집계는 20,941 ms 라 1레이어는 map_sample 을 읽어야 한다.
		when(mapper.findLayerOneSample()).thenReturn(List.of(row(1L, null)));

		adapter.findResidentSet(new MajorQuery(1, List.of(), 1000));

		verify(mapper).findLayerOneSample(); // 정적 집합은 자르지 않는다(실측 1,094칸)
		verify(mapper, never()).findInAccumulatedBoxes(anyList(), anyInt());
	}

	@Test
	void level2_passesAccumulatedBoxesInOrder() {
		LayerBox layer1 = new LayerBox(1, -1.5, -0.25, 0.5, 2.0);
		when(mapper.findInAccumulatedBoxes(anyList(), anyInt())).thenReturn(List.of());

		adapter.findResidentSet(new MajorQuery(2, List.of(layer1), 1000));

		verify(mapper).findInAccumulatedBoxes(List.of(layer1), 1000);
		verify(mapper, never()).findLayerOneSample();
	}

	@Test
	void copiesStoredCoordinatesVerbatim_as16Axes() {
		when(mapper.findLayerOneSample()).thenReturn(List.of(row(7L, null)));

		MapPoint point = adapter.findResidentSet(new MajorQuery(1, List.of(), 1000)).get(0);

		assertEquals(MapPoint.PC_DIMS, point.pc().size());
		assertEquals(PCS[0], point.pc().get(0)); // 재계산·반올림 없음 (FR-007)
		assertEquals(PCS[1], point.pc().get(1));
		assertEquals(PCS[15], point.pc().get(15));
		assertEquals(7L, point.musicId());
	}

	@Test
	void genreIdIsNoGenre_andWeightIsUniform() {
		// genreId 는 FE NO_GENRE_ID(10). 0 을 보내면 앰비언트 청록이라 지도가 한 색이 된다.
		// weight 는 인기 지표 부재로 균일값(D17).
		when(mapper.findLayerOneSample()).thenReturn(List.of(row(1L, null), row(2L, "https://y/2")));

		List<MapPoint> points = adapter.findResidentSet(new MajorQuery(1, List.of(), 1000));

		assertTrue(points.stream().allMatch(p -> p.genreId() == 10));
		assertTrue(points.stream().allMatch(p -> p.weight() == 0));
	}

	@Test
	void youtubeUrl_isBuiltFromTitleAndArtist_notTheNullColumn() {
		// music.youtube_url 은 662만 행 전부 NULL 이다. 저장값이 아니라 title·artist 로 만든다(D12).
		when(mapper.findLayerOneSample()).thenReturn(List.of(row(1L, null), row(2L, "https://y/2")));

		List<MapPoint> points = adapter.findResidentSet(new MajorQuery(1, List.of(), 1000));

		// 컬럼이 NULL 인 1번도 URL 이 생긴다 — 예전엔 이 행이 playable=false 였다.
		assertEquals(YoutubeSearchUrl.of("a1", "t1"), points.get(0).youtubeUrl());
		assertTrue(points.get(0).playable());
		// 컬럼에 값이 있어도 읽지 않는다.
		assertEquals(YoutubeSearchUrl.of("a2", "t2"), points.get(1).youtubeUrl());
	}

	@Test
	void playable_isFalse_whenTitleAndArtistAreBothBlank() {
		// 적재 실측상 제목이 빈 문자열인 곡이 3,977개 있다. 그 곡은 검색어를 만들 수 없다.
		MapPointRow blank = row(3L, null);
		blank.setTitle("");
		blank.setArtist("");
		when(mapper.findLayerOneSample()).thenReturn(List.of(blank));

		List<MapPoint> points = adapter.findResidentSet(new MajorQuery(1, List.of(), 1000));

		assertNull(points.get(0).youtubeUrl());
		assertFalse(points.get(0).playable());
	}

	@Test
	void rejectsAxisBeyondPcDims() {
		// XML 이 축 첨자를 ${} 로 넣으므로 SQL 에 닿기 전에 막는다. layer 9 는 pc17·pc18 을 요구한다.
		List<LayerBox> boxes = List.of(
				new LayerBox(1, 0, 0, 1, 1), new LayerBox(2, 0, 0, 1, 1), new LayerBox(3, 0, 0, 1, 1),
				new LayerBox(4, 0, 0, 1, 1), new LayerBox(5, 0, 0, 1, 1), new LayerBox(6, 0, 0, 1, 1),
				new LayerBox(7, 0, 0, 1, 1), new LayerBox(8, 0, 0, 1, 1), new LayerBox(9, 0, 0, 1, 1));

		assertThrows(IllegalArgumentException.class,
				() -> adapter.findResidentSet(new MajorQuery(10, boxes, 1000)));
	}
}
