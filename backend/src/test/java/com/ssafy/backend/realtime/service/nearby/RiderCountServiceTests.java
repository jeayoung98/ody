package com.ssafy.backend.realtime.service.nearby;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;

@ExtendWith(MockitoExtension.class)
@DisplayName("따라오는 인원 수 읽기")
class RiderCountServiceTests {

	@Mock RideRedisRepository rideRedisRepository;

	@InjectMocks RiderCountServiceImpl riderCountService;

	@Test
	@DisplayName("한 명은 저장소에 그대로 묻는다")
	void asksOne() {
		when(rideRedisRepository.riderCount("a@test.local")).thenReturn(3);

		assertThat(riderCountService.count("a@test.local")).isEqualTo(3);
	}

	/** 한 명씩 물으면 사람 수만큼 왕복이 생긴다. 묶어 묻는 길로 가야 한다. */
	@Test
	@DisplayName("여러 명은 한 번에 묶어 묻는다")
	void asksManyAtOnce() {
		List<String> people = List.of("a@test.local", "b@test.local");
		when(rideRedisRepository.riderCountsOf(people)).thenReturn(Map.of("a@test.local", 2));

		Map<String, Integer> result = riderCountService.countAll(people);

		assertThat(result).containsOnlyKeys("a@test.local");
		assertThat(result.get("a@test.local")).isEqualTo(2);
		verify(rideRedisRepository).riderCountsOf(people);
	}
}
