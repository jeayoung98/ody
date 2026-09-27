package com.ssafy.backend.realtime.service.music;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.ssafy.backend.music.detail.MusicDetailReader;
import com.ssafy.backend.music.dto.Location;
import com.ssafy.backend.music.dto.MusicDetail;

@SuppressWarnings("unchecked")
class MusicLocationServiceImplTests {

	private final MusicDetailReader reader = mock(MusicDetailReader.class);
	private final MusicLocationServiceImpl adapter = new MusicLocationServiceImpl(reader);

	@Test
	@DisplayName("PC1부터 PC16까지 순서대로 배열에 담는다")
	void mapsPcInOrder() {
		when(reader.findLocationsByIds(List.of(42L))).thenReturn(Map.of(42L, location(1)));

		assertThat(adapter.findLocation(42L)).hasValueSatisfying(pc -> {
			assertThat(pc).hasSize(16);
			for (int i = 0; i < 16; i++) {
				assertThat(pc[i]).isEqualTo(i + 1.0);
			}
		});
	}

	@Test
	@DisplayName("없는 곡은 빈 결과를 돌려준다")
	void missingSong_empty() {
		when(reader.findLocationsByIds(List.of(999L))).thenReturn(Map.of());
		assertThat(adapter.findLocation(999L)).isEmpty();
	}

	@Test
	@DisplayName("곡 존재 여부는 상세 조회 결과가 있는지로 판단한다")
	void existsDelegatesToDetailLookup() {
		MusicDetail detail = new MusicDetail(
				42L, null, "t", "a", null, null, null, null, null, null, null, null, null, null);
		when(reader.findDetail(42L)).thenReturn(java.util.Optional.of(detail));
		when(reader.findDetail(999L)).thenReturn(java.util.Optional.empty());

		assertThat(adapter.exists(42L)).isTrue();
		assertThat(adapter.exists(999L)).isFalse();
	}

	@Test
	@DisplayName("30개가 넘는 곡은 30개씩 나눠 읽는다")
	void readsAtMostThirtyIdsAtOnce() {
		List<Long> ids = new ArrayList<>();
		Map<Long, Location> firstResult = new LinkedHashMap<>();
		for (long id = 1; id <= 31; id++) {
			ids.add(id);
			if (id <= 30) {
				firstResult.put(id, location(id));
			}
		}
		when(reader.findLocationsByIds(ids.subList(0, 30))).thenReturn(firstResult);
		when(reader.findLocationsByIds(List.of(31L))).thenReturn(Map.of(31L, location(31)));

		Map<Long, double[]> result = adapter.findLocations(ids);

		assertThat(result).hasSize(31);
		ArgumentCaptor<List<Long>> idsCaptor = ArgumentCaptor.forClass(List.class);
		verify(reader, org.mockito.Mockito.times(2)).findLocationsByIds(idsCaptor.capture());
		assertThat(idsCaptor.getAllValues()).allSatisfy(batch -> assertThat(batch).hasSizeLessThanOrEqualTo(30));
	}

	private static Location location(double start) {
		return new Location(
				start, start + 1, start + 2, start + 3,
				start + 4, start + 5, start + 6, start + 7,
				start + 8, start + 9, start + 10, start + 11,
				start + 12, start + 13, start + 14, start + 15);
	}
}
