package com.ssafy.backend.feedback;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.security.oauth2.client.autoconfigure.OAuth2ClientAutoConfiguration;
import org.springframework.boot.security.oauth2.client.autoconfigure.servlet.OAuth2ClientWebSecurityAutoConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.ssafy.backend.config.SecurityConfig;
import com.ssafy.backend.feedback.controller.FeedbackController;
import com.ssafy.backend.feedback.dto.FeedbackResponse;
import com.ssafy.backend.feedback.service.FeedbackService;
import com.ssafy.backend.security.JwtAuthenticationFilter;

/** 설문 컨트롤러 슬라이스 (PlaylistControllerTests 와 같은 구성). 비로그인·형식 오류·정상 3건. */
@WebMvcTest(controllers = FeedbackController.class, excludeFilters = @ComponentScan.Filter(
		type = FilterType.ASSIGNABLE_TYPE, classes = { SecurityConfig.class, JwtAuthenticationFilter.class }),
		excludeAutoConfiguration = { OAuth2ClientAutoConfiguration.class, OAuth2ClientWebSecurityAutoConfiguration.class })
@AutoConfigureMockMvc(addFilters = false)
class FeedbackControllerTests {

	private static final String BODY = """
			{"sessionId":"6f1a2b3c-4d5e-4f60-8a9b-0c1d2e3f4a5b","anonymousId":"0b6a0d8e-1c2f-4a3b-9d4e-5f6a7b8c9d0e","mode":"nearby","rank":3,
			 "anchorMusicId":1,"musicId":55,"verdict":false,"reason":"mood","listenedSec":42,"skipped":true}
			""";

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private FeedbackService feedbackService;

	@Test
	void save_loggedIn_passesEmail() throws Exception {
		when(feedbackService.save(any(), eq("me@gmail.com"))).thenReturn(new FeedbackResponse(7));
		mockMvc.perform(post("/api/feedback").contentType(MediaType.APPLICATION_JSON).content(BODY)
						.principal(new UsernamePasswordAuthenticationToken(
								"me@gmail.com", null, List.of(new SimpleGrantedAuthority("ROLE_USER")))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.feedbackId").value(7));
	}

	@Test
	void save_anonymous_passesNullEmail() throws Exception {
		when(feedbackService.save(any(), isNull())).thenReturn(new FeedbackResponse(8));
		mockMvc.perform(post("/api/feedback").contentType(MediaType.APPLICATION_JSON).content(BODY))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.feedbackId").value(8));
	}

	@Test
	void save_badModeOrReason_returns400() throws Exception {
		mockMvc.perform(post("/api/feedback").contentType(MediaType.APPLICATION_JSON)
						.content(BODY.replace("\"nearby\"", "\"random\"")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
		mockMvc.perform(post("/api/feedback").contentType(MediaType.APPLICATION_JSON)
						.content(BODY.replace("\"mood\"", "\"boring\"")))
				.andExpect(status().isBadRequest());
		mockMvc.perform(post("/api/feedback").contentType(MediaType.APPLICATION_JSON)
						.content(BODY.replace("6f1a2b3c-4d5e-4f60-8a9b-0c1d2e3f4a5b", "not-a-uuid")))
				.andExpect(status().isBadRequest());
	}
}
