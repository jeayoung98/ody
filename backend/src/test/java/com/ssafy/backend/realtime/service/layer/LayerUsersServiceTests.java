package com.ssafy.backend.realtime.service.layer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.IntStream;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;
import com.ssafy.backend.realtime.config.RealtimeProperties;
import com.ssafy.backend.realtime.dto.layer.LayerUsersSnapshot;
import com.ssafy.backend.realtime.dto.presence.UserDisplay;
import com.ssafy.backend.realtime.dto.viewport.ViewportMusicGroup;
import com.ssafy.backend.realtime.dto.viewport.ViewportUser;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator;
import com.ssafy.backend.realtime.geometry.ViewportCellCalculator.Cell;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.service.music.MusicLocationService;
import com.ssafy.backend.realtime.service.nearby.RiderCountService;
import com.ssafy.backend.realtime.service.user.UserDisplayService;

/** 레이어 전체 사용자 목록 — 셀 전부를 읽고, 본인을 빼고, 좌표 없는 곡을 건너뛰는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class LayerUsersServiceTests {

	private static final String ME = "me@x.com";

	@Mock PresenceRedisRepository presenceRepository;
	@Mock MusicLocationService musicLocationService;
	@Mock UserDisplayService userDisplayService;
	@Mock RiderCountService riderCountService;

	private LayerUsersService service;

	@BeforeEach
	void setUp() {
		List<RealtimeProperties.AxisRange> ranges = IntStream.rangeClosed(1, 16)
				.mapToObj(axis -> new RealtimeProperties.AxisRange(axis, 0, 16))
				.toList();
		RealtimeProperties properties = new RealtimeProperties(
				new RealtimeProperties.Presence(15_000, 45_000, 10_000, 60_000),
				new RealtimeProperties.Nearby(10),
				new RealtimeProperties.ViewportSettings(16, 36, 20, 64, 250, 5_000),
				ranges);
		service = new LayerUsersService(new MusicPositionCalculator(properties),
				presenceRepository, musicLocationService, userDisplayService, riderCountService);
	}

	@Test
	@DisplayName("레이어 1(pc3·pc4)의 모든 셀을 읽어 곡 위치별로 묶고, 나는 빼고, 좌표 없는 곡은 건너뛴다")
	void groupsByMusicExcludingSelfAndSkippingUnknownLocation() {
		when(presenceRepository.findActiveMusicIdsByCell(eq(1), anyList()))
				.thenAnswer(inv -> {
					List<Cell> cells = inv.getArgument(1);
					assertThat(cells).hasSize(256); // 16x16 전부
					return Map.of(cells.get(0), Set.of(101L, 202L));
				});
		when(musicLocationService.findLocations(List.of(101L, 202L)))
				.thenReturn(Map.of(101L, pc(1, 2, 5, 6))); // 202 는 좌표 없음
		when(presenceRepository.findListenersByMusic(1, List.of(101L, 202L)))
				.thenReturn(Map.of(101L, Set.of(ME, "a@x.com"), 202L, Set.of("b@x.com")));
		when(riderCountService.countAll(anyCollection())).thenReturn(Map.of("a@x.com", 2));
		when(userDisplayService.find("a@x.com")).thenReturn(new UserDisplay("nickA", "imgA"));

		LayerUsersSnapshot result = service.findAll(1, ME);

		assertThat(result.layer()).isEqualTo(1);
		assertThat(result.groups()).hasSize(1);
		ViewportMusicGroup group = result.groups().get(0);
		assertThat(group.musicId()).isEqualTo(101L);
		assertThat(group.x()).isEqualTo(5.0); // pc3
		assertThat(group.y()).isEqualTo(6.0); // pc4
		assertThat(group.users()).containsExactly(new ViewportUser("a@x.com", "nickA", "imgA", 2));
	}

	@Test
	@DisplayName("요청자가 null 이면 아무도 빼지 않는다")
	void nullRequesterKeepsEveryone() {
		when(presenceRepository.findActiveMusicIdsByCell(eq(0), anyList()))
				.thenReturn(Map.of(new Cell(0, 0), Set.of(101L)));
		when(musicLocationService.findLocations(List.of(101L))).thenReturn(Map.of(101L, pc(1, 2, 0, 0)));
		when(presenceRepository.findListenersByMusic(0, List.of(101L)))
				.thenReturn(Map.of(101L, Set.of(ME)));
		when(riderCountService.countAll(anyCollection())).thenReturn(Map.of());
		when(userDisplayService.find(ME)).thenReturn(new UserDisplay(null, null));

		LayerUsersSnapshot result = service.findAll(0, null);

		assertThat(result.groups()).hasSize(1);
		assertThat(result.groups().get(0).users()).extracting(ViewportUser::email).containsExactly(ME);
	}

	@Test
	@DisplayName("범위 밖 레이어는 INVALID_INPUT 이고 Redis 를 읽지 않는다")
	void invalidLayerRejected() {
		assertThatThrownBy(() -> service.findAll(8, ME))
				.isInstanceOfSatisfying(CustomException.class,
						e -> assertThat(e.getErrorCode()).isEqualTo(GlobalErrorCode.INVALID_INPUT));
		verifyNoInteractions(presenceRepository, musicLocationService);
	}

	@Test
	@DisplayName("아무도 없으면 빈 목록이고 좌표·청취자 조회를 하지 않는다")
	void emptyLayer() {
		when(presenceRepository.findActiveMusicIdsByCell(anyInt(), anyList())).thenReturn(Map.of());

		assertThat(service.findAll(3, ME).groups()).isEmpty();
		verifyNoInteractions(musicLocationService, userDisplayService);
	}

	private static double[] pc(double pc1, double pc2, double pc3, double pc4) {
		double[] r = new double[16];
		r[0] = pc1; r[1] = pc2; r[2] = pc3; r[3] = pc4;
		return r;
	}
}
