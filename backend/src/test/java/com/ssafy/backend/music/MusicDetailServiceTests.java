package com.ssafy.backend.music;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.MusicErrorCode;
import com.ssafy.backend.music.detail.MusicDetailReader;
import com.ssafy.backend.music.dto.Location;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.music.dto.MusicDetailResponse;
import com.ssafy.backend.music.dto.MusicSummary;
import com.ssafy.backend.music.dto.NeighborTrack;
import com.ssafy.backend.music.service.MusicService;
import com.ssafy.backend.music.service.NearbyService;
import com.ssafy.backend.music.videoid.VideoIdEnricher;

/**
 * 상세 서비스 유닛 (mock port). 조립·pass-through·404·B-D 대기 동작 검증.
 * neighbors 실제 정렬·자기 제외·최근접성은 어댑터(SQL) 책임 → 여기선 개수·위임만 검증(계약).
 */
class MusicDetailServiceTests {

	private static final Location LOC =
			new Location(-0.4213, 1.0872, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -0.123);

	private static MusicDetail detail() {
		return new MusicDetail(10234L, "b1a9c0e9", "Love wins all", "IU", 128.4, 275, "The Winning", "8f3a...", 2024,
				"https://youtu.be/x", null, LOC, 1428, 3);
	}

	private static NeighborTrack neighbor(long id, double distance) {
		return new NeighborTrack(
				new MusicSummary(id, "t", "IU", "Palette", "https://youtu.be/y", null, LOC),
				distance);
	}

	private static MusicService serviceWith(MusicDetailReader reader, NearbyService nearby) {
		return serviceWith(reader, nearby, Mockito.mock(VideoIdEnricher.class));
	}

	private static MusicService serviceWith(MusicDetailReader reader, NearbyService nearby, VideoIdEnricher enricher) {
		return new MusicService(Optional.empty(), Optional.ofNullable(reader), Optional.empty(), nearby, enricher);
	}

	@Test
	void getDetail_assemblesDetailAndNeighbors_fromSharedSelection() {
		MusicDetailReader reader = Mockito.mock(MusicDetailReader.class);
		NearbyService nearby = Mockito.mock(NearbyService.class);
		when(reader.findDetail(10234L)).thenReturn(Optional.of(detail()));
		when(nearby.neighborsOf(Mockito.any())).thenReturn(
				new NearbyService.NeighborResult(List.of(neighbor(1L, 0.01), neighbor(2L, 0.02)), false));

		MusicDetailResponse res = serviceWith(reader, nearby).getDetail(10234L);

		assertThat(res.detail().id()).isEqualTo(10234L);
		assertThat(res.neighbors()).hasSize(2);
		assertThat(res.neighbors().get(0).distance()).isEqualTo(0.01);
		assertThat(res.lowSimilarity()).isFalse();
	}

	@Test
	void getDetail_fewerNeighborsThan10_passesThrough() {
		MusicDetailReader reader = Mockito.mock(MusicDetailReader.class);
		NearbyService nearby = Mockito.mock(NearbyService.class);
		when(reader.findDetail(10234L)).thenReturn(Optional.of(detail()));
		when(nearby.neighborsOf(Mockito.any()))
				.thenReturn(new NearbyService.NeighborResult(List.of(neighbor(1L, 0.01)), false));

		assertThat(serviceWith(reader, nearby).getDetail(10234L).neighbors()).hasSize(1);
	}

	/** E2 — 유사도 낮음 표시가 곡 상세 응답에도 그대로 실린다 (005 SC-006). */
	@Test
	void getDetail_carriesLowSimilarityFromSharedSelection() {
		MusicDetailReader reader = Mockito.mock(MusicDetailReader.class);
		NearbyService nearby = Mockito.mock(NearbyService.class);
		when(reader.findDetail(10234L)).thenReturn(Optional.of(detail()));
		when(nearby.neighborsOf(Mockito.any()))
				.thenReturn(new NearbyService.NeighborResult(List.of(neighbor(1L, 5.0)), true));

		assertThat(serviceWith(reader, nearby).getDetail(10234L).lowSimilarity()).isTrue();
	}

	/**
	 * E1 — 곡 상세와 주변 탐색이 <b>같은 선정 결과</b>를 쓴다 (005 FR-023, SC-006).
	 *
	 * <p>둘이 같은 목록을 준다는 것을 규칙을 두 번 흉내 내서가 아니라 <b>같은 메서드를 지나간다는 사실</b>로
	 * 확인한다. 규칙이 갈라지려면 이 호출이 사라져야 하고, 그러면 이 테스트가 깨진다.
	 */
	@Test
	void getDetail_delegatesNeighborSelectionToSharedPath() {
		MusicDetailReader reader = Mockito.mock(MusicDetailReader.class);
		NearbyService nearby = Mockito.mock(NearbyService.class);
		MusicDetail center = detail();
		when(reader.findDetail(10234L)).thenReturn(Optional.of(center));
		when(nearby.neighborsOf(center))
				.thenReturn(new NearbyService.NeighborResult(List.of(neighbor(1L, 0.01)), false));

		serviceWith(reader, nearby).getDetail(10234L);

		verify(nearby).neighborsOf(center);
		verify(reader, Mockito.never()).findSummariesByIds(Mockito.anyList());
	}

	@Test
	void getDetail_missingSong_throwsMusicNotFound() {
		MusicDetailReader reader = Mockito.mock(MusicDetailReader.class);
		when(reader.findDetail(999L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> serviceWith(reader, Mockito.mock(NearbyService.class)).getDetail(999L))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(MusicErrorCode.MUSIC_NOT_FOUND);
	}

	@Test
	void getDetail_noReader_throwsUnsupported() {
		assertThatThrownBy(() -> serviceWith(null, Mockito.mock(NearbyService.class)).getDetail(10234L))
				.isInstanceOf(UnsupportedOperationException.class);
	}

	/** S15P21A405-322 — 곡 상세는 중심곡 videoId 만 외부 API 로 채운다. */
	@Test
	void getDetail_enrichesVideoId_onlyForCenter() {
		MusicDetailReader reader = Mockito.mock(MusicDetailReader.class);
		NearbyService nearby = Mockito.mock(NearbyService.class);
		VideoIdEnricher enricher = Mockito.mock(VideoIdEnricher.class);
		MusicDetail center = detail();
		when(reader.findDetail(10234L)).thenReturn(Optional.of(center));
		when(nearby.neighborsOf(center))
				.thenReturn(new NearbyService.NeighborResult(List.of(neighbor(1L, 0.01)), false));
		when(enricher.resolve(10234L, "IU", "Love wins all", "The Winning", null, 275)).thenReturn("centerVideoId");

		MusicDetailResponse res = serviceWith(reader, nearby, enricher).getDetail(10234L);

		assertThat(res.detail().videoId()).isEqualTo("centerVideoId");
		// 이웃곡은 최대 10건이라 순차 호출하면 느려져 걷어냈다 — DB 값(여기선 null) 그대로 나간다.
		assertThat(res.neighbors().get(0).music().videoId()).isNull();
		verify(enricher, Mockito.never()).resolve(Mockito.eq(1L), Mockito.any(), Mockito.any(), Mockito.any(),
				Mockito.any(), Mockito.any());
	}
}
