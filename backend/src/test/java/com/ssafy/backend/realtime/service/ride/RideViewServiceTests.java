package com.ssafy.backend.realtime.service.ride;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.Set;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.realtime.dto.ride.RideViewKind;
import com.ssafy.backend.realtime.dto.ride.RideViewPayload;
import com.ssafy.backend.realtime.dto.ride.RideViewRequest;
import com.ssafy.backend.realtime.error.WebSocketErrorCode;
import com.ssafy.backend.realtime.error.WebSocketRequestException;
import com.ssafy.backend.realtime.message.RealtimeMessageService;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.message.WebSocketDestination;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;

/** 인솔자가 지도를 보는 모양이 따라오는 사람들에게 가는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class RideViewServiceTests {

	private static final String CAPTAIN = "captain@x.com";
	private static final String RIDER = "rider@x.com";

	@Mock RideRedisRepository rideRedisRepository;
	@Mock RealtimeMessageService realtimeMessageService;
	@Mock RideGuard rideGuard;
	@InjectMocks RideViewService service;

	@Test
	@DisplayName("여정을 열면 시작곡·끝곡만 담아 저장하고 따라오는 사람에게 넘긴다")
	void journeySavesAndSends() {
		when(rideRedisRepository.riders(CAPTAIN)).thenReturn(Set.of(RIDER));
		RideViewPayload expected = new RideViewPayload(RideViewKind.JOURNEY, 10L, 20L, null, null);

		// 종류에 맞지 않는 번호(playlistId)는 버려져야 한다.
		service.relay(CAPTAIN, new RideViewRequest(RideViewKind.JOURNEY, 10L, 20L, 99L, null));

		verify(rideRedisRepository).saveView(CAPTAIN, expected);
		verify(realtimeMessageService).sendToUser(RIDER, WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.RIDE_VIEW, expected);
	}

	@Test
	@DisplayName("기본 지도로 돌아가면 저장해 둔 것을 지우고 기본이라고 넘긴다")
	void defaultDeletesAndSends() {
		when(rideRedisRepository.riders(CAPTAIN)).thenReturn(Set.of(RIDER));

		service.relay(CAPTAIN, new RideViewRequest(RideViewKind.DEFAULT, null, null, null, null));

		verify(rideRedisRepository).deleteView(CAPTAIN);
		verify(rideRedisRepository, never()).saveView(anyString(), any());
		verify(realtimeMessageService).sendToUser(RIDER, WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.RIDE_VIEW, new RideViewPayload(RideViewKind.DEFAULT, null, null, null, null));
	}

	@Test
	@DisplayName("따라오는 사람이 없으면 저장만 하고 보내지 않는다")
	void noRidersSkipsSend() {
		when(rideRedisRepository.riders(CAPTAIN)).thenReturn(Set.of());

		service.relay(CAPTAIN, new RideViewRequest(RideViewKind.NEARBY, null, null, null, 7L));

		verify(rideRedisRepository).saveView(CAPTAIN, new RideViewPayload(RideViewKind.NEARBY, null, null, null, 7L));
		verifyNoInteractions(realtimeMessageService);
	}

	@Test
	@DisplayName("따라가는 중인 사람이 보내면 거부하고 저장하지 않는다")
	void riderCannotControl() {
		org.mockito.Mockito.doThrow(new WebSocketRequestException(
				WebSocketErrorCode.RIDE_NOT_CAPTAIN, "따라가는 중에는 지도 화면을 바꿀 수 없다"))
				.when(rideGuard).requireNotRiding(anyString(), anyString());

		assertThatThrownBy(() ->
				service.relay(RIDER, new RideViewRequest(RideViewKind.PLAYLIST, null, null, 3L, null)))
				.isInstanceOf(WebSocketRequestException.class)
				.extracting(e -> ((WebSocketRequestException) e).getCode())
				.isEqualTo(WebSocketErrorCode.RIDE_NOT_CAPTAIN);

		verify(rideRedisRepository, never()).saveView(anyString(), any());
		verify(rideRedisRepository, never()).deleteView(anyString());
	}

	@Test
	@DisplayName("종류에 필요한 번호가 빠지면 저장까지 가지 않는다")
	void missingIdRejected() {
		assertThatThrownBy(() -> service.relay(CAPTAIN, new RideViewRequest(RideViewKind.JOURNEY, 10L, null, null, null)))
				.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> service.relay(CAPTAIN, new RideViewRequest(null, null, null, null, null)))
				.isInstanceOf(IllegalArgumentException.class);

		verifyNoInteractions(rideRedisRepository, realtimeMessageService);
	}

	@Test
	@DisplayName("탑승 직후 인솔자가 저장해 둔 화면이 있으면 그 사람에게만 한 번 보낸다")
	void sendCurrentSendsSavedView() {
		RideViewPayload saved = new RideViewPayload(RideViewKind.PLAYLIST, null, null, 3L, null);
		when(rideRedisRepository.findView(CAPTAIN)).thenReturn(saved);

		service.sendCurrent(RIDER, CAPTAIN);

		verify(realtimeMessageService).sendToUser(RIDER, WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.RIDE_VIEW, saved);
	}

	@Test
	@DisplayName("탑승 직후 저장된 화면이 없으면(기본 지도) 아무것도 보내지 않는다")
	void sendCurrentSkipsDefault() {
		when(rideRedisRepository.findView(CAPTAIN)).thenReturn(null);

		service.sendCurrent(RIDER, CAPTAIN);

		verifyNoInteractions(realtimeMessageService);
	}
}
