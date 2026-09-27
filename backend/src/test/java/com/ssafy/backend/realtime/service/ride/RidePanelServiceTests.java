package com.ssafy.backend.realtime.service.ride;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
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

import com.ssafy.backend.realtime.dto.ride.RidePanelPayload;
import com.ssafy.backend.realtime.dto.ride.RidePanelRequest;
import com.ssafy.backend.realtime.dto.ride.RidePanelTab;
import com.ssafy.backend.realtime.error.WebSocketErrorCode;
import com.ssafy.backend.realtime.error.WebSocketRequestException;
import com.ssafy.backend.realtime.message.RealtimeMessageService;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.message.WebSocketDestination;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;

/** 인솔자가 연 곡 상세가 따라오는 사람들에게 가는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class RidePanelServiceTests {

	private static final String CAPTAIN = "captain@x.com";
	private static final String RIDER = "rider@x.com";
	private static final long MUSIC = 4927L;

	@Mock RideRedisRepository rideRedisRepository;
	@Mock RealtimeMessageService realtimeMessageService;
	@Mock RideGuard rideGuard;
	@InjectMocks RidePanelService service;

	@Test
	@DisplayName("열면 저장하고 따라오는 사람에게 넘긴다")
	void openSavesAndSends() {
		when(rideRedisRepository.riders(CAPTAIN)).thenReturn(Set.of(RIDER));

		service.relay(CAPTAIN, new RidePanelRequest(true, MUSIC, RidePanelTab.INFO));

		verify(rideRedisRepository).savePanel(CAPTAIN, MUSIC, RidePanelTab.INFO);
		verify(realtimeMessageService).sendToUser(RIDER, WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.RIDE_PANEL, RidePanelPayload.opened(MUSIC, RidePanelTab.INFO));
	}

	@Test
	@DisplayName("탭만 바꿔도 바뀐 탭으로 저장하고 넘긴다")
	void tabChangeSavesAndSends() {
		when(rideRedisRepository.riders(CAPTAIN)).thenReturn(Set.of(RIDER));

		service.relay(CAPTAIN, new RidePanelRequest(true, MUSIC, RidePanelTab.PLAYLISTS));

		verify(rideRedisRepository).savePanel(CAPTAIN, MUSIC, RidePanelTab.PLAYLISTS);
		verify(realtimeMessageService).sendToUser(RIDER, WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.RIDE_PANEL,
				RidePanelPayload.opened(MUSIC, RidePanelTab.PLAYLISTS));
	}

	/** 닫힌 상태를 값으로 남겨 두면 그것도 저장해야 한다. 키를 지우는 쪽이 간단하다. */
	@Test
	@DisplayName("닫으면 저장해 둔 것을 지우고 닫혔다고 넘긴다")
	void closeDeletesAndSends() {
		when(rideRedisRepository.riders(CAPTAIN)).thenReturn(Set.of(RIDER));

		service.relay(CAPTAIN, new RidePanelRequest(false, null, null));

		verify(rideRedisRepository).deletePanel(CAPTAIN);
		verify(rideRedisRepository, never()).savePanel(anyString(), anyLong(), any());
		verify(realtimeMessageService).sendToUser(RIDER, WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.RIDE_PANEL, RidePanelPayload.closed());
	}

	@Test
	@DisplayName("따라오는 사람이 없으면 저장만 하고 보내지 않는다")
	void noRidersSkipsSend() {
		when(rideRedisRepository.riders(CAPTAIN)).thenReturn(Set.of());

		service.relay(CAPTAIN, new RidePanelRequest(true, MUSIC, RidePanelTab.NEARBY));

		verify(rideRedisRepository).savePanel(CAPTAIN, MUSIC, RidePanelTab.NEARBY);
		verifyNoInteractions(realtimeMessageService);
	}

	@Test
	@DisplayName("따라가는 중인 사람이 보내면 거부한다")
	void riderCannotControl() {
		org.mockito.Mockito.doThrow(new WebSocketRequestException(
				WebSocketErrorCode.RIDE_NOT_CAPTAIN, "따라가는 중에는 곡 상세를 바꿀 수 없다"))
				.when(rideGuard).requireNotRiding(anyString(), anyString());

		assertThatThrownBy(() ->
				service.relay(RIDER, new RidePanelRequest(true, MUSIC, RidePanelTab.INFO)))
				.isInstanceOf(WebSocketRequestException.class)
				.extracting(e -> ((WebSocketRequestException) e).getCode())
				.isEqualTo(WebSocketErrorCode.RIDE_NOT_CAPTAIN);

		verify(rideRedisRepository, never()).savePanel(anyString(), anyLong(), any());
		verify(rideRedisRepository, never()).deletePanel(anyString());
	}

	@Test
	@DisplayName("모르는 탭은 저장까지 가지 않는다")
	void unknownTabRejected() {
		assertThatThrownBy(() -> service.relay(CAPTAIN, new RidePanelRequest(true, MUSIC, null)))
				.isInstanceOf(IllegalArgumentException.class);

		verifyNoInteractions(realtimeMessageService);
	}
}
