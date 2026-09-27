package com.ssafy.backend.realtime.service.ride;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.realtime.dto.viewport.ViewportMode;
import com.ssafy.backend.realtime.geometry.ViewportRange;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository.CloseResult;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository.ViewportMeta;
import com.ssafy.backend.realtime.service.nearby.NearbyPeopleService;

/** 따라가기를 시작할 때 혼자 보던 구독이 끊기는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class RideSubscriptionServiceTests {

	private static final String RIDER = "rider@x.com";

	@Mock ViewportRedisRepository viewportRedisRepository;
	@Mock NearbyPeopleService nearbyPeopleService;
	@InjectMocks RideSubscriptionService service;

	private static ViewportMeta meta(long epoch, long requestSeq) {
		return new ViewportMeta(epoch, requestSeq, ViewportMode.INDIVIDUAL,
				new ViewportRange(0, -2, 6, -2, 6, java.util.List.of()), Set.of());
	}

	/** 안 끊으면 인솔자 동네 위에 자기 옛 동네 사람들이 겹쳐 뜬다. */
	@Test
	@DisplayName("보던 화면이 있으면 그 화면을 연 번호로 닫는다")
	void closesOwnScreen() {
		when(viewportRedisRepository.findMeta(RIDER)).thenReturn(Optional.of(meta(7L, 12L)));
		when(viewportRedisRepository.closeCurrentScreen(RIDER, 7L, 12L)).thenReturn(CloseResult.CLOSED);

		service.closeOwnViews(RIDER, 7L);

		verify(viewportRedisRepository).closeCurrentScreen(RIDER, 7L, 12L);
	}

	@Test
	@DisplayName("보던 화면이 없으면 닫지 않는다")
	void skipsWhenNoScreen() {
		when(viewportRedisRepository.findMeta(RIDER)).thenReturn(Optional.empty());

		service.closeOwnViews(RIDER, 7L);

		verify(viewportRedisRepository, never()).closeCurrentScreen(anyString(), anyLong(), anyLong());
	}

	@Test
	@DisplayName("주변사람 구독도 같이 닫는다")
	void closesNearby() {
		when(viewportRedisRepository.findMeta(RIDER)).thenReturn(Optional.empty());

		service.closeOwnViews(RIDER, 7L);

		verify(nearbyPeopleService).close(RIDER, 7L);
	}

	/** 화면을 못 닫아도 주변사람은 닫아야 한다. 하나가 남으면 그쪽 알림이 계속 온다. */
	@Test
	@DisplayName("화면 닫기가 실패해도 주변사람은 닫는다")
	void closesNearbyEvenWhenScreenCloseFails() {
		when(viewportRedisRepository.findMeta(RIDER)).thenReturn(Optional.of(meta(3L, 5L)));
		when(viewportRedisRepository.closeCurrentScreen(RIDER, 3L, 5L))
				.thenReturn(CloseResult.STALE_CONNECTION);

		service.closeOwnViews(RIDER, 7L);

		verify(nearbyPeopleService).close(RIDER, 7L);
	}
}
