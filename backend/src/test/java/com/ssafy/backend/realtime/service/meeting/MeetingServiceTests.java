package com.ssafy.backend.realtime.service.meeting;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;

import com.ssafy.backend.realtime.repository.mapper.MeetingMapper;

@ExtendWith(MockitoExtension.class)
@DisplayName("하차 시점 만남 기록")
class MeetingServiceTests {

	private static final String CAPTAIN = "a@test.dev";
	private static final String RIDER = "b@test.dev";
	private static final String MATE = "c@test.dev";
	private static final String OUTSIDER = "d@test.dev";

	@Mock MeetingMapper meetingMapper;

	@Mock StringRedisTemplate redis;

	@Mock ValueOperations<String, String> valueOps;

	@InjectMocks MeetingService meetingService;

	@BeforeEach
	void setUp() {
		ReflectionTestUtils.setField(meetingService, "cooldownSec", 180L);
		// 쿨다운에 안 걸린 상태가 기본이다. 걸린 경우만 테스트에서 따로 바꾼다.
		lenient().when(redis.opsForValue()).thenReturn(valueOps);
		lenient().when(valueOps.setIfAbsent(anyString(), eq("1"), any(Duration.class))).thenReturn(true);
	}

	/** 따라다닌 것은 만남이 아니다. 인솔자도 동료도 세면 안 된다. */
	@Test
	@DisplayName("선단에 속한 사람은 만남으로 세지 않는다")
	void fleetMembersAreLeftOut() {
		meetingService.recordOnDismount(
				List.of(RIDER),
				List.of(CAPTAIN, MATE, OUTSIDER),
				Set.of(CAPTAIN, RIDER, MATE));

		verify(meetingMapper).upsertIncrement(RIDER, OUTSIDER);
		verify(meetingMapper, never()).upsertIncrement(CAPTAIN, RIDER);
		verify(meetingMapper, never()).upsertIncrement(RIDER, MATE);
	}

	@Test
	@DisplayName("내린 사람이 여럿이면 각자 제3자와 센다")
	void everyDismountedMeetsEveryOutsider() {
		String another = "e@test.dev";

		meetingService.recordOnDismount(
				List.of(RIDER, MATE),
				List.of(CAPTAIN, OUTSIDER, another),
				Set.of(CAPTAIN, RIDER, MATE));

		verify(meetingMapper).upsertIncrement(RIDER, OUTSIDER);
		verify(meetingMapper).upsertIncrement(RIDER, another);
		verify(meetingMapper).upsertIncrement(MATE, OUTSIDER);
		verify(meetingMapper).upsertIncrement(MATE, another);
	}

	/** 저장 규칙이 사전순이라 조회도 맞으려면 넣을 때 정렬돼야 한다. */
	@Test
	@DisplayName("두 사람을 사전순으로 넣는다")
	void pairIsSorted() {
		meetingService.recordOnDismount(
				List.of(OUTSIDER), List.of(CAPTAIN), Set.of());

		verify(meetingMapper).upsertIncrement(CAPTAIN, OUTSIDER);
	}

	@Test
	@DisplayName("제3자가 없으면 아무것도 세지 않는다")
	void noOutsiderMeansNothing() {
		meetingService.recordOnDismount(
				List.of(RIDER), List.of(CAPTAIN), Set.of(CAPTAIN, RIDER));

		verifyNoInteractions(meetingMapper);
	}

	@Test
	@DisplayName("내린 사람이나 거주자 명단이 비면 읽지도 않는다")
	void emptyInputDoesNothing() {
		meetingService.recordOnDismount(List.of(), List.of(OUTSIDER), Set.of());
		meetingService.recordOnDismount(List.of(RIDER), List.of(), Set.of());
		meetingService.recordOnDismount(null, List.of(OUTSIDER), Set.of());
		meetingService.recordOnDismount(List.of(RIDER), null, Set.of());

		verifyNoInteractions(meetingMapper, redis);
	}

	/** 같은 두 사람이 3분 안에 또 만나면 세지 않는다. 따라가기 직전의 기록과 겹치는 것을 이걸로 막는다. */
	@Test
	@DisplayName("쿨다운 중이면 세지 않는다")
	void cooldownBlocks() {
		when(valueOps.setIfAbsent(anyString(), eq("1"), any(Duration.class))).thenReturn(false);

		meetingService.recordOnDismount(List.of(RIDER), List.of(OUTSIDER), Set.of());

		verifyNoInteractions(meetingMapper);
	}

	/** 한 쌍이 실패해도 나머지는 계속 세야 한다. 실 유저가 없으면 FK 위반이 난다. */
	@Test
	@DisplayName("한 쌍이 실패해도 나머지를 센다")
	void oneFailureDoesNotStopTheRest() {
		when(meetingMapper.upsertIncrement(RIDER, OUTSIDER)).thenThrow(new RuntimeException("FK"));

		meetingService.recordOnDismount(
				List.of(RIDER), List.of(OUTSIDER, "e@test.dev"), Set.of());

		verify(meetingMapper).upsertIncrement(RIDER, "e@test.dev");
	}
}
