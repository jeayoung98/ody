package com.ssafy.backend.realtime.service.play;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;
import com.ssafy.backend.common.MusicErrorCode;
import com.ssafy.backend.realtime.error.RealtimeErrorCode;
import com.ssafy.backend.realtime.dto.play.PlayHistoryRow;
import com.ssafy.backend.realtime.dto.play.PlayResponse;
import com.ssafy.backend.realtime.event.PositionChanged;
import com.ssafy.backend.realtime.event.RealtimeEventService;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator.Placement;
import com.ssafy.backend.realtime.repository.mapper.PlayHistoryMapper;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.PresenceSnapshot;
import com.ssafy.backend.realtime.service.meeting.MeetingService;
import com.ssafy.backend.realtime.service.music.MusicLocationService;

/** 곡 변경 뒤 이전 위치와 새 위치를 알리는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class MusicPlayServiceTests {

	private static final String EMAIL = "user@x.com";

	@Mock PresenceRedisRepository presenceRedisRepository;
	@Mock MusicLocationService musicLocationService;
	@Mock MusicPositionCalculator musicPositionCalculator;
	@Mock RealtimeEventService realtimeEventService;
	@Mock PlayHistoryMapper playHistoryMapper;
	@Mock MeetingService meetingService;
	@InjectMocks MusicPlayService service;

	@Test
	@DisplayName("곡을 바꾸면 이전 위치와 새 위치를 알린다")
	void playPublishesOldAndNewPosition() {
		double[] location = new double[16];
		Placement placement = new Placement(2, 3, 4, 0.2, 0.7, 2, 7);
		when(presenceRedisRepository.snapshot(EMAIL))
				.thenReturn(new PresenceSnapshot(10L, 2, 1, 1, 7L));
		when(musicLocationService.findLocation(20L)).thenReturn(Optional.of(location));
		when(musicPositionCalculator.calculate(location, 2)).thenReturn(placement);
		when(presenceRedisRepository.applyPlay(
				EMAIL, 10L, 2, 1, 1,
				20L, 2, 0.2, 0.7, 2, 7)).thenReturn(List.of());

		// 요청에 다른 레이어(5)를 넣어도 서 있는 레이어(2)를 유지한다.
		service.play(EMAIL, 20L, "MAP", 5);

		PositionChanged event = new PositionChanged(
				EMAIL, 7L, 2, 2,
				10L, 20L,
				"1:1", "2:7",
				0.2, 0.7);
		InOrder order = Mockito.inOrder(
				presenceRedisRepository, playHistoryMapper, realtimeEventService, meetingService);
		order.verify(presenceRedisRepository).applyPlay(
				EMAIL, 10L, 2, 1, 1,
				20L, 2, 0.2, 0.7, 2, 7);
		order.verify(playHistoryMapper).insert(org.mockito.ArgumentMatchers.any(PlayHistoryRow.class));
		order.verify(realtimeEventService).send(event);
		order.verify(meetingService).recordMeetings(EMAIL, List.of());
	}

	@Test
	@DisplayName("같은 곡을 다시 재생하면 기록만 만들고 위치 변경은 알리지 않는다")
	void replayingSameMusicDoesNotPublishMove() {
		double[] location = new double[16];
		Placement placement = new Placement(2, 3, 4, 0.2, 0.7, 2, 7);
		when(presenceRedisRepository.snapshot(EMAIL))
				.thenReturn(new PresenceSnapshot(20L, 2, 2, 7, 7L));
		when(musicLocationService.findLocation(20L)).thenReturn(Optional.of(location));
		when(musicPositionCalculator.calculate(location, 2)).thenReturn(placement);
		when(presenceRedisRepository.applyPlay(
				EMAIL, 20L, 2, 2, 7,
				20L, 2, 0.2, 0.7, 2, 7)).thenReturn(List.of());

		service.play(EMAIL, 20L, "MAP", null);

		verify(playHistoryMapper).insert(org.mockito.ArgumentMatchers.any(PlayHistoryRow.class));
		verify(playHistoryMapper).incrementPlayCnt(20L);
		verify(meetingService).recordMeetings(EMAIL, List.of());
		verifyNoInteractions(realtimeEventService);
	}

	@Test
	@DisplayName("아직 지도에 없는 사용자는 요청한 레이어로 첫 자리를 잡는다")
	void firstPlayPlacesAtRequestedLayer() {
		double[] location = new double[16];
		Placement placement = new Placement(3, 5, 6, 0.4, 0.6, 6, 9);
		// 접속만 하고 아무 곡도 안 들은 상태: 곡·레이어·셀이 전부 없다.
		when(presenceRedisRepository.snapshot(EMAIL))
				.thenReturn(new PresenceSnapshot(null, null, null, null, 7L));
		when(musicLocationService.findLocation(20L)).thenReturn(Optional.of(location));
		when(musicPositionCalculator.calculate(location, 3)).thenReturn(placement);
		when(presenceRedisRepository.applyPlay(
				EMAIL, null, null, null, null,
				20L, 3, 0.4, 0.6, 6, 9)).thenReturn(List.of());

		PlayResponse response = service.play(EMAIL, 20L, "MAP", 3);

		assertThat(response.layer()).isEqualTo(3);
		verify(presenceRedisRepository).applyPlay(
				EMAIL, null, null, null, null,
				20L, 3, 0.4, 0.6, 6, 9);
		// 첫 진입이므로 이전 값 없이 새 위치만 알린다.
		verify(realtimeEventService).send(new PositionChanged(
				EMAIL, 7L, null, 3,
				null, 20L,
				null, "6:9",
				0.4, 0.6));
	}

	@Test
	@DisplayName("지도에 없고 요청에도 레이어가 없으면 어디에 놓을지 몰라 거부한다")
	void firstPlayWithoutLayerIsRejected() {
		when(presenceRedisRepository.snapshot(EMAIL))
				.thenReturn(new PresenceSnapshot(null, null, null, null, 7L));

		assertThatThrownBy(() -> service.play(EMAIL, 20L, "MAP", null))
				.isInstanceOf(CustomException.class);

		verifyNoInteractions(musicLocationService, playHistoryMapper, realtimeEventService, meetingService);
	}

	@Test
	@DisplayName("존재하지 않는 곡은 404 MUSIC_NOT_FOUND 로 거부한다")
	void missingMusicIsNotFound() {
		when(presenceRedisRepository.snapshot(EMAIL))
				.thenReturn(new PresenceSnapshot(10L, 2, 1, 1, 7L));
		when(musicLocationService.findLocation(999L)).thenReturn(Optional.empty());
		when(musicLocationService.exists(999L)).thenReturn(false);

		assertThatThrownBy(() -> service.play(EMAIL, 999L, "MAP", null))
				.isInstanceOfSatisfying(CustomException.class,
						e -> assertThat(e.getErrorCode()).isEqualTo(MusicErrorCode.MUSIC_NOT_FOUND));

		verifyNoInteractions(playHistoryMapper, realtimeEventService, meetingService);
	}

	@Test
	@DisplayName("곡은 있지만 좌표가 없으면 422 PRESENCE_ERROR 로 거부한다")
	void musicWithoutLocationIsPresenceError() {
		when(presenceRedisRepository.snapshot(EMAIL))
				.thenReturn(new PresenceSnapshot(10L, 2, 1, 1, 7L));
		when(musicLocationService.findLocation(20L)).thenReturn(Optional.empty());
		when(musicLocationService.exists(20L)).thenReturn(true);

		assertThatThrownBy(() -> service.play(EMAIL, 20L, "MAP", null))
				.isInstanceOfSatisfying(CustomException.class,
						e -> assertThat(e.getErrorCode()).isEqualTo(RealtimeErrorCode.PRESENCE_ERROR));

		verifyNoInteractions(playHistoryMapper, realtimeEventService, meetingService);
	}

	@Test
	@DisplayName("재생 종료는 내 기록이면 재생 시간을 갱신한다")
	void playEndUpdatesOwnHistory() {
		when(playHistoryMapper.updatePlayedMs(88L, EMAIL, 123_000L)).thenReturn(1);

		service.playEnd(EMAIL, 88L, 123_000L);

		verify(playHistoryMapper).updatePlayedMs(88L, EMAIL, 123_000L);
	}

	@Test
	@DisplayName("남의 기록이거나 없는 기록이면 403 FORBIDDEN 으로 거부한다")
	void playEndOnForeignOrMissingHistoryIsForbidden() {
		// 소유자 불일치와 미존재 모두 갱신 행 0 — 존재 유무를 드러내지 않기 위해 같은 코드로 거부한다.
		when(playHistoryMapper.updatePlayedMs(88L, EMAIL, 123_000L)).thenReturn(0);

		assertThatThrownBy(() -> service.playEnd(EMAIL, 88L, 123_000L))
				.isInstanceOfSatisfying(CustomException.class,
						e -> assertThat(e.getErrorCode()).isEqualTo(GlobalErrorCode.FORBIDDEN));
	}
}
