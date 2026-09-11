package com.ssafy.backend;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.metrics.test.autoconfigure.AutoConfigureMetrics;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

/**
 * FR-011 / SC-004: 운영 지표 노출과 확인 방법을 검증으로 고정한다.
 *
 * 요청 수·지연·오류는 master 가 이미 켜 둔 `http.server.requests` 히스토그램으로 덮인다(M7).
 * 이 테스트는 그 설정이 조용히 사라지거나 actuator 노출 범위가 넓어지는 것을 잡는다.
 * 대표곡 '반환 수' 지표는 성공 경로가 아직 없으므로(`getMajor` 미구현) T015 와 함께 넣는다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureMetrics // 테스트에서는 지표 export 가 기본 비활성이라 명시적으로 켠다
class ObservabilityTests {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void prometheusExposesRequestLatencyHistogram() throws Exception {
		// 지표가 기록되도록 요청을 한 번 흘린다. 대표곡은 미구현(500)이라 오류 경로로 기록된다.
		mockMvc.perform(get("/music/major").param("level", "1"));

		mockMvc.perform(get("/actuator/prometheus"))
				.andExpect(status().isOk())
				.andExpect(content().string(Matchers.containsString("http_server_requests_seconds")))
				// percentiles-histogram: true 가 살아 있어야 버킷이 나온다.
				.andExpect(content().string(Matchers.containsString("http_server_requests_seconds_bucket")));
	}

	@Test
	void secretBearingActuatorEndpointsAreNotExposed() throws Exception {
		// SC-004: 노출은 health,prometheus 로만. env/configprops 는 DB 비밀번호·JWT secret 을 그대로 흘린다.
		// 상태코드를 404 로 고정하지 않는 이유: GlobalExceptionHandler 의 catch-all 이 미등록 경로를 500 으로 감싼다(별도 결함).
		// 여기서 지켜야 할 불변식은 "노출되지 않는다" 이므로 200 아님 + 비밀값 미포함으로 본다.
		mockMvc.perform(get("/actuator/env"))
				.andExpect(status().is(Matchers.not(200)))
				.andExpect(content().string(Matchers.not(Matchers.containsString("test-jwt-secret"))));
		mockMvc.perform(get("/actuator/configprops"))
				.andExpect(status().is(Matchers.not(200)));
	}
}
