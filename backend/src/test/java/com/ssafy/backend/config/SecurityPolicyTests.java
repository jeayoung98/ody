package com.ssafy.backend.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 인증 정책을 필터 체인째로 고정한다 (정본 §0.7 기본 거부, S15P21A405-33 · 원복 S15P21A405-245).
 *
 * <p>컨트롤러 슬라이스 테스트는 전부 {@link SecurityConfig} 를 제외하고 돌기 때문에 인가 설정이
 * 바뀌어도 아무것도 깨지지 않는다. S15P21A405-243 의 한시 permitAll 이 그렇게 일주일 넘게 남아
 * 인증 실패가 401 대신 500 으로 나갔다(S15P21A405-478). 이 테스트는 실제 SecurityFilterChain 을
 * 띄워 그 구멍을 막는다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SecurityPolicyTests {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void protectedApi_withoutToken_returns401() throws Exception {
		mockMvc.perform(get("/api/music/search").param("query", "IU").param("page", "0"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.error.code").value("UNAUTHENTICATED"));
	}

	/**
	 * 회귀 방지 (S15P21A405-478): permitAll 이던 동안 토큰 없는 요청이 컨트롤러까지 들어가
	 * {@code authentication.getName()} 에서 NPE 500 이 났다. 프론트는 401 에서만 재발급을 태운다.
	 */
	@Test
	void userDetail_withoutToken_returns401NotServerError() throws Exception {
		mockMvc.perform(get("/api/user/detail").param("email", "someone@example.com"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.error.code").value("UNAUTHENTICATED"));
	}

	@Test
	void invalidSignatureToken_returns401() throws Exception {
		// 서명만 다른 구조상 유효한 JWT. 필터가 JwtException 을 삼키고 인증 없이 통과시키므로
		// 최종 응답은 EntryPoint 의 401 이어야 한다.
		String forged = "eyJhbGciOiJIUzI1NiJ9"
				+ ".eyJzdWIiOiJhdHRhY2tlckBleGFtcGxlLmNvbSIsInRva2VuVHlwZSI6ImFjY2VzcyJ9"
				+ ".Zm9yZ2VkLXNpZ25hdHVyZS1ub3QtdmFsaWQ";

		mockMvc.perform(get("/api/user/detail")
						.param("email", "someone@example.com")
						.header("Authorization", "Bearer " + forged))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.error.code").value("UNAUTHENTICATED"));
	}

	@Test
	void playlistApi_withoutToken_returns401() throws Exception {
		mockMvc.perform(get("/api/playlist/search").param("email", "someone@example.com"))
				.andExpect(status().isUnauthorized());
	}

	/**
	 * 비로그인 허용 경로는 인가 단계에서 막히면 안 된다 (정본 §5.2 인증 선택, S15P21A405-346).
	 * 뒤 단계에서 무엇이 나오든 상관없고, 401 이 아니어야 한다는 것만 본다.
	 */
	@Test
	void feedbackAnswered_withoutToken_isNotBlockedByAuthorization() throws Exception {
		mockMvc.perform(get("/api/feedback/answered")
						.param("anonymousId", "3f1b2c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d"))
				.andExpect(status().is(Matchers.not(401)));
	}

	/** 음원 신고도 비로그인 허용이다 [S15P21A405-388]. */
	@Test
	void musicReport_withoutToken_isNotBlockedByAuthorization() throws Exception {
		mockMvc.perform(post("/api/music/report")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"musicId\":1,\"reason\":\"noise\"}"))
				.andExpect(status().is(Matchers.not(401)));
	}

	/**
	 * 헬스체크는 공개다. 테스트 프로파일엔 Redis 가 없어 본문은 DOWN(503) 이므로 상태값은 보지 않고,
	 * 인가 단계에서 막히지 않는다는 것만 본다.
	 */
	@Test
	void healthCheck_withoutToken_isNotBlockedByAuthorization() throws Exception {
		mockMvc.perform(get("/actuator/health")).andExpect(status().is(Matchers.not(401)));
	}
}
