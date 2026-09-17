package com.ssafy.backend.realtime.service.play;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.realtime.dto.play.PlayHistoryRow;
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

		service.play(EMAIL, 20L, "MAP");

		verify(realtimeEventService).send(new PositionChanged(
				EMAIL, 7L, 2, 2,
				10L, 20L,
				"1:1", "2:7",
				0.2, 0.7));
		verify(playHistoryMapper).insert(org.mockito.ArgumentMatchers.any(PlayHistoryRow.class));
		verify(playHistoryMapper).incrementPlayCnt(20L);
		verify(meetingService).recordMeetings(EMAIL, List.of());
	}
}
