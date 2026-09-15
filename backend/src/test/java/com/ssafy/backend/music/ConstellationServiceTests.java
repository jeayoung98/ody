package com.ssafy.backend.music;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;
import com.ssafy.backend.common.MusicErrorCode;
import com.ssafy.backend.music.detail.MusicDetailReader;
import com.ssafy.backend.music.dto.ConstellationLayoutResponse;
import com.ssafy.backend.music.dto.ConstellationPoint;
import com.ssafy.backend.music.dto.Location;
import com.ssafy.backend.music.service.ConstellationService;

/**
 * 별자리 배치 서비스 단위 테스트 (quickstart Q9~Q13). 좌표 조회는 mock 이고,
 * 여기서는 서비스가 지는 책임 — 검증·왕복 수·누락 판정·응답 순서 — 만 본다.
 */
class ConstellationServiceTests {

	private final MusicDetailReader reader = mock(MusicDetailReader.class);
	private final ConstellationService service = new ConstellationService(Optional.of(reader));

	private static Location location(long seed) {
		double[] pc = new double[16];
		for (int d = 0; d < pc.length; d++) {
			pc[d] = Math.sin(seed * 1.7 + d * 0.3) * (1 + d % 4);
		}
		return new Location(pc[0], pc[1], pc[2], pc[3], pc[4], pc[5], pc[6], pc[7],
				pc[8], pc[9], pc[10], pc[11], pc[12], pc[13], pc[14], pc[15]);
	}

	private static Map<Long, Location> locations(List<Long> musicIds) {
		Map<Long, Location> map = new LinkedHashMap<>();
		musicIds.forEach(musicId -> map.put(musicId, location(musicId)));
		return map;
	}

	private static List<Long> ids(int count) {
		List<Long> musicIds = new ArrayList<>(count);
		for (int i = 1; i <= count; i++) {
			musicIds.add((long) i * 11);
		}
		return musicIds;
	}

	@Test
	void returnsOnePointPerTrack_inRequestOrder() { // Q9 (FR-001, FR-009)
		List<Long> musicIds = List.of(40L, 10L, 30L, 20L);
		when(reader.findLocationsByIds(musicIds)).thenReturn(locations(musicIds));

		ConstellationLayoutResponse response = service.layout(musicIds);

		assertEquals(musicIds, response.points().stream().map(ConstellationPoint::musicId).toList());
		for (ConstellationPoint point : response.points()) {
			assertTrue(Math.abs(point.x()) <= 1 && Math.abs(point.y()) <= 1, "좌표가 범위를 벗어났다: " + point);
		}
	}

	@Test
	void readsCoordinates_inASingleRoundTrip() { // Q10 (FR-011, SC-003)
		List<Long> musicIds = ids(30);
		when(reader.findLocationsByIds(musicIds)).thenReturn(locations(musicIds));

		service.layout(musicIds);

		verify(reader, times(1)).findLocationsByIds(anyList());
		verify(reader, never()).findDetail(anyLong()); // 곡당 왕복으로 돌아가지 않았는지
	}

	@Test
	void missingTrack_failsWholeRequest_ratherThanDrawingPartialShape() { // Q11 (FR-014)
		List<Long> musicIds = List.of(1L, 2L, 3L, 4L);
		Map<Long, Location> partial = locations(List.of(1L, 2L, 3L)); // 4번 곡이 없다
		when(reader.findLocationsByIds(musicIds)).thenReturn(partial);

		CustomException thrown = assertThrows(CustomException.class, () -> service.layout(musicIds));

		assertEquals(MusicErrorCode.MUSIC_NOT_FOUND, thrown.getErrorCode());
	}

	@Test
	void rejectsRequestsThatCannotFormAShape() { // Q12 (FR-013)
		assertInvalid(List.of());
		assertInvalid(List.of(1L));
		assertInvalid(ids(31));
		assertInvalid(List.of(7L, 7L)); // 조용히 합치지 않는다
		assertInvalid(List.of(1L, 0L));
		assertInvalid(Arrays.asList(1L, null));
		assertInvalid(null);

		verify(reader, never()).findLocationsByIds(anyList()); // 검증 전에 DB 를 치지 않는다
	}

	@Test
	void missingAdapter_failsLoudly() { // Q13
		ConstellationService withoutReader = new ConstellationService(Optional.empty());

		assertThrows(UnsupportedOperationException.class, () -> withoutReader.layout(List.of(1L, 2L)));
	}

	private void assertInvalid(List<Long> musicIds) {
		CustomException thrown = assertThrows(CustomException.class, () -> service.layout(musicIds),
				"거부해야 하는 입력이 통과했다: " + musicIds);
		assertEquals(GlobalErrorCode.INVALID_INPUT, thrown.getErrorCode());
	}
}
