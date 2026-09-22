package com.ssafy.backend.realtime.service.nearby;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.realtime.config.RealtimeProperties;
import com.ssafy.backend.realtime.dto.layer.LayerUsersSnapshot;
import com.ssafy.backend.realtime.dto.nearby.NearbyPerson;
import com.ssafy.backend.realtime.dto.nearby.NearbySnapshot;
import com.ssafy.backend.realtime.dto.viewport.ViewportMusicGroup;
import com.ssafy.backend.realtime.dto.viewport.ViewportUser;
import com.ssafy.backend.realtime.error.RealtimeErrorCode;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator;
import com.ssafy.backend.realtime.repository.redis.NearbyRedisRepository;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.PresenceSnapshot;
import com.ssafy.backend.realtime.service.layer.LayerUsersService;
import com.ssafy.backend.realtime.service.meeting.MeetingService;
import com.ssafy.backend.realtime.service.music.MusicLocationService;
import com.ssafy.backend.realtime.session.WebSocketSessionService;

/**
 * 주변사람 목록 만드는 로직만 따로 검증. DB·Redis 안 붙이고 가짜(mock)로 채운다.
 *
 * 기준이 레이어 전체로 바뀌었다 (S15P21A405-582). 그 층 사람을 읽는 일은
 * {@link LayerUsersService} 가 하므로 여기서는 가짜로 두고, 이 클래스가 실제로 하는 일
 * — 거리 계산 · 가까운 순 자르기 · 만난 횟수 붙이기 · 구독 순서 — 만 본다.
 */
@ExtendWith(MockitoExtension.class)
class NearbyPeopleServiceTests {

	@Mock PresenceRedisRepository presenceRepository;
	@Mock LayerUsersService layerUsersService;
	@Mock MusicLocationService musicLocationService;
	@Mock MusicPositionCalculator musicPositionCalculator;
	@Mock NearbyRedisRepository nearbyRepository;
	@Mock MeetingService meetingService;
	@Mock WebSocketSessionService webSocketSessionService;
	@Mock RealtimeProperties realtimeProperties;
	@InjectMocks NearbyPeopleService service;

	private static final String ME = "me@x.com";
	private static final int LAYER = 1;

	/** 레이어 1 의 표시축은 3·4 번째 값이다. 자리 계산이 그 두 칸만 본다. */
	private static final int[] AXES = {3, 4};

	@BeforeEach
	void defaultSettings() {
		lenient().when(realtimeProperties.nearby()).thenReturn(new RealtimeProperties.Nearby(10, 12));
		lenient().when(musicPositionCalculator.findAxes(LAYER)).thenReturn(AXES);
		lenient().when(meetingService.countWith(anyString(), anyString())).thenReturn(0);
	}

	/** 표시축 두 칸에만 값을 넣은 16차원 좌표. */
	private static double[] at(double x, double y) {
		double[] pc = new double[16];
		pc[AXES[0] - 1] = x;
		pc[AXES[1] - 1] = y;
		return pc;
	}

	private static ViewportUser user(String email) {
		return new ViewportUser(email, email.substring(0, 2), null, 0);
	}

	private void givenMyself(double x, double y) {
		when(presenceRepository.snapshot(ME)).thenReturn(new PresenceSnapshot(100L, LAYER, 0, 0, 1L));
		lenient().when(musicLocationService.findLocation(100L)).thenReturn(Optional.of(at(x, y)));
		lenient().when(nearbyRepository.replaceSubscriptions(anyString(), anyLong(), anyList()))
				.thenReturn(true);
		lenient().when(webSocketSessionService.currentMessageSeq(ME)).thenReturn(7L);
	}

	@SuppressWarnings("unchecked")
	private static List<Long> anyList() {
		return org.mockito.ArgumentMatchers.anyList();
	}

	@Test
	@DisplayName("서 있는 곡이 없으면 PRESENCE_ERROR 로 막는다")
	void noAnchor() {
		when(presenceRepository.snapshot(ME)).thenReturn(null);

		assertThatThrownBy(() -> service.open(ME))
				.isInstanceOfSatisfying(CustomException.class,
						e -> assertThat(e.getErrorCode()).isEqualTo(RealtimeErrorCode.PRESENCE_ERROR));

		verifyNoInteractions(layerUsersService);
	}

	/** 곡은 있는데 층이 없는 상태도 자리를 모르는 것이라 같다. */
	@Test
	@DisplayName("서 있는 층이 없어도 막는다")
	void noLayer() {
		when(presenceRepository.snapshot(ME)).thenReturn(new PresenceSnapshot(100L, null, 0, 0, 1L));

		assertThatThrownBy(() -> service.open(ME))
				.isInstanceOfSatisfying(CustomException.class,
						e -> assertThat(e.getErrorCode()).isEqualTo(RealtimeErrorCode.PRESENCE_ERROR));
	}

	/** 내 층의 사람을 전부 담는다. 곡이 비슷한지는 더 이상 보지 않는다. */
	@Test
	@DisplayName("내 층 사람을 평면 목록으로 편다")
	void flattensEveryoneOnMyLayer() {
		givenMyself(0.0, 0.0);
		when(layerUsersService.findAll(LAYER, ME)).thenReturn(new LayerUsersSnapshot(LAYER, List.of(
				new ViewportMusicGroup(100L, 0.0, 0.0, List.of(user("u1@x.com"))),
				new ViewportMusicGroup(500L, 3.0, 4.0, List.of(user("u2@x.com"), user("u3@x.com"))))));

		NearbySnapshot res = service.open(ME);

		assertThat(res.anchorMusicId()).isEqualTo(100L);
		assertThat(res.snapshotSeq()).isEqualTo(7L);
		assertThat(res.people()).extracting(NearbyPerson::email)
				.containsExactlyInAnyOrder("u1@x.com", "u2@x.com", "u3@x.com");
	}

	/** 자리를 줘야 받는 쪽이 패널을 미니맵으로 그린다. 같은 곡이면 같은 자리다. */
	@Test
	@DisplayName("사람마다 곡의 자리와 내 자리에서의 거리를 담는다")
	void carriesSpotAndDistance() {
		givenMyself(0.0, 0.0);
		when(layerUsersService.findAll(LAYER, ME)).thenReturn(new LayerUsersSnapshot(LAYER, List.of(
				new ViewportMusicGroup(500L, 3.0, 4.0, List.of(user("u2@x.com"))))));

		NearbyPerson person = service.open(ME).people().get(0);

		assertThat(person.x()).isEqualTo(3.0);
		assertThat(person.y()).isEqualTo(4.0);
		assertThat(person.distance()).isEqualTo(5.0); // 3-4-5
	}

	@Test
	@DisplayName("가까운 순으로 정렬한다")
	void sortedByDistance() {
		givenMyself(0.0, 0.0);
		when(layerUsersService.findAll(LAYER, ME)).thenReturn(new LayerUsersSnapshot(LAYER, List.of(
				new ViewportMusicGroup(500L, 9.0, 0.0, List.of(user("far@x.com"))),
				new ViewportMusicGroup(600L, 1.0, 0.0, List.of(user("near@x.com"))))));

		assertThat(service.open(ME).people()).extracting(NearbyPerson::email)
				.containsExactly("near@x.com", "far@x.com");
	}

	/** 사람이 많은 층에서는 레이더도 목록도 못 읽는다. 가까운 쪽부터 남긴다. */
	@Test
	@DisplayName("상한을 넘으면 가까운 쪽만 남긴다")
	void cutsToPanelCap() {
		when(realtimeProperties.nearby()).thenReturn(new RealtimeProperties.Nearby(10, 2));
		givenMyself(0.0, 0.0);
		when(layerUsersService.findAll(LAYER, ME)).thenReturn(new LayerUsersSnapshot(LAYER, List.of(
				new ViewportMusicGroup(500L, 9.0, 0.0, List.of(user("c3@x.com"))),
				new ViewportMusicGroup(600L, 1.0, 0.0, List.of(user("a1@x.com"))),
				new ViewportMusicGroup(700L, 5.0, 0.0, List.of(user("b2@x.com"))))));

		assertThat(service.open(ME).people()).extracting(NearbyPerson::email)
				.containsExactly("a1@x.com", "b2@x.com");
	}

	/**
	 * 만난 횟수는 사람마다 한 번씩 조회가 도는 자리다. 자르기 전에 세면 화면에 안 나갈 사람까지 센다.
	 */
	@Test
	@DisplayName("만난 횟수는 자른 뒤에만 센다")
	void meetingCountedAfterCut() {
		when(realtimeProperties.nearby()).thenReturn(new RealtimeProperties.Nearby(10, 1));
		givenMyself(0.0, 0.0);
		when(meetingService.countWith(ME, "near@x.com")).thenReturn(3);
		when(layerUsersService.findAll(LAYER, ME)).thenReturn(new LayerUsersSnapshot(LAYER, List.of(
				new ViewportMusicGroup(500L, 9.0, 0.0, List.of(user("far@x.com"))),
				new ViewportMusicGroup(600L, 1.0, 0.0, List.of(user("near@x.com"))))));

		assertThat(service.open(ME).people()).singleElement()
				.satisfies(p -> assertThat(p.meetingCount()).isEqualTo(3));

		verify(meetingService).countWith(ME, "near@x.com");
		verify(meetingService, never()).countWith(ME, "far@x.com");
	}

	/** 목록을 만드는 사이의 변경도 받아야 한다. 구독이 순번 읽기보다 먼저다. */
	@Test
	@DisplayName("구독을 바꾼 뒤에 기준 순번을 읽는다")
	void subscribesBeforeReadingSeq() {
		givenMyself(0.0, 0.0);
		when(layerUsersService.findAll(LAYER, ME)).thenReturn(new LayerUsersSnapshot(LAYER, List.of(
				new ViewportMusicGroup(500L, 1.0, 0.0, List.of(user("u2@x.com"))))));

		service.open(ME);

		InOrder order = inOrder(nearbyRepository, webSocketSessionService);
		order.verify(nearbyRepository).replaceSubscriptions(ME, 1L, List.of(500L));
		order.verify(webSocketSessionService).currentMessageSeq(ME);
	}

	@Test
	@DisplayName("접속이 바뀌면 목록을 주지 않는다")
	void staleEpochIsRejected() {
		when(presenceRepository.snapshot(ME)).thenReturn(new PresenceSnapshot(100L, LAYER, 0, 0, 1L));
		when(layerUsersService.findAll(LAYER, ME)).thenReturn(new LayerUsersSnapshot(LAYER, List.of()));
		when(nearbyRepository.replaceSubscriptions(ME, 1L, List.of())).thenReturn(false);

		assertThatThrownBy(() -> service.open(ME))
				.isInstanceOfSatisfying(CustomException.class,
						e -> assertThat(e.getErrorCode()).isEqualTo(RealtimeErrorCode.PRESENCE_ERROR));
	}

	/**
	 * 내 곡의 좌표를 못 찾아도 목록은 준다. 그 층에 누가 있는지는 여전히 뜻이 있고,
	 * 거리만 0 이 되어 순서가 임의가 될 뿐이다.
	 */
	@Test
	@DisplayName("내 자리를 못 구해도 목록은 준다")
	void missingMySpotStillAnswers() {
		when(presenceRepository.snapshot(ME)).thenReturn(new PresenceSnapshot(100L, LAYER, 0, 0, 1L));
		when(musicLocationService.findLocation(100L)).thenReturn(Optional.empty());
		when(nearbyRepository.replaceSubscriptions(ME, 1L, List.of(500L))).thenReturn(true);
		when(webSocketSessionService.currentMessageSeq(ME)).thenReturn(7L);
		when(layerUsersService.findAll(LAYER, ME)).thenReturn(new LayerUsersSnapshot(LAYER, List.of(
				new ViewportMusicGroup(500L, 3.0, 4.0, List.of(user("u2@x.com"))))));

		assertThat(service.open(ME).people()).singleElement()
				.satisfies(p -> assertThat(p.distance()).isZero());
	}

	@Test
	@DisplayName("닫기는 현재 접속 버전으로 구독을 해제한다")
	void closeUsesEpoch() {
		service.close(ME, 9L);

		verify(nearbyRepository).closeSubscriptions(ME, 9L);
	}
}
