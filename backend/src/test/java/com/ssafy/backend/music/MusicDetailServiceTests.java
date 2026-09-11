package com.ssafy.backend.music;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
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

/**
 * 상세 서비스 유닛 (mock port). 조립·pass-through·404·B-D 대기 동작 검증.
 * neighbors 실제 정렬·자기 제외·최근접성은 어댑터(SQL) 책임 → 여기선 개수·위임만 검증(계약).
 */
class MusicDetailServiceTests {

	private static final Location LOC =
			new Location(-0.4213, 1.0872, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -0.123);

	private static MusicDetail detail() {
		return new MusicDetail(10234L, "b1a9c0e9", "Love wins all", "IU", 128.4, 275, "The Winning",
				List.of("K-Pop"), "https://youtu.be/x", LOC, 1428, 3);
	}

	private static NeighborTrack neighbor(long id, double distance) {
		return new NeighborTrack(
				new MusicSummary(id, "t", "IU", "Palette", List.of("K-Pop"), "https://youtu.be/y", LOC),
				distance);
	}

	@Test
	void getDetail_assemblesDetailAndNeighbors_requesting10() {
		MusicDetailReader reader = Mockito.mock(MusicDetailReader.class);
		when(reader.findDetail(10234L)).thenReturn(Optional.of(detail()));
		when(reader.findNeighbors(eq(10234L), eq(10)))
				.thenReturn(List.of(neighbor(1L, 0.01), neighbor(2L, 0.02)));
		MusicService service = new MusicService(Optional.empty(), Optional.of(reader));

		MusicDetailResponse res = service.getDetail(10234L);

		assertThat(res.detail().id()).isEqualTo(10234L);
		assertThat(res.neighbors()).hasSize(2);
		assertThat(res.neighbors().get(0).distance()).isEqualTo(0.01);
		verify(reader).findNeighbors(10234L, 10); // 고정 10곡 요청 (정본 §3.2)
	}

	@Test
	void getDetail_fewerNeighborsThan10_passesThrough() {
		MusicDetailReader reader = Mockito.mock(MusicDetailReader.class);
		when(reader.findDetail(10234L)).thenReturn(Optional.of(detail()));
		when(reader.findNeighbors(10234L, 10)).thenReturn(List.of(neighbor(1L, 0.01)));
		MusicService service = new MusicService(Optional.empty(), Optional.of(reader));

		assertThat(service.getDetail(10234L).neighbors()).hasSize(1);
	}

	@Test
	void getDetail_missingSong_throwsMusicNotFound() {
		MusicDetailReader reader = Mockito.mock(MusicDetailReader.class);
		when(reader.findDetail(999L)).thenReturn(Optional.empty());
		MusicService service = new MusicService(Optional.empty(), Optional.of(reader));

		assertThatThrownBy(() -> service.getDetail(999L))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(MusicErrorCode.MUSIC_NOT_FOUND);
	}

	@Test
	void getDetail_noReader_throwsUnsupported() {
		MusicService service = new MusicService(Optional.empty(), Optional.empty());

		assertThatThrownBy(() -> service.getDetail(10234L))
				.isInstanceOf(UnsupportedOperationException.class);
	}
}
