package com.ssafy.backend.config;

import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 현재 시각 주입 (S15P21A405-448).
 *
 * 주간 집계처럼 "지금이 언제인가"에 결과가 달라지는 코드는 Clock 을 받아야 테스트에서 특정 시점을
 * 고정할 수 있다. LocalDate.now() 를 직접 부르면 주 경계 동작을 검증할 방법이 없다.
 */
@Configuration
public class ClockConfig {

	@Bean
	public Clock clock() {
		return Clock.systemDefaultZone();
	}
}
