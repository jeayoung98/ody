package com.ssafy.backend.follow;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
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

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.UserErrorCode;
import com.ssafy.backend.config.SecurityConfig;
import com.ssafy.backend.follow.dto.FollowListResponse;
import com.ssafy.backend.follow.dto.FollowRequest;
import com.ssafy.backend.follow.dto.FollowResponse;
import com.ssafy.backend.follow.dto.FollowUserSummary;
import com.ssafy.backend.follow.service.FollowService;
import com.ssafy.backend.security.JwtAuthenticationFilter;

/**
 * 팔로우 컨트롤러 슬라이스 (S15P21A405-433). 팔로우를 거는 쪽은 요청 본문이 아니라 토큰 주체다.
 */
@WebMvcTest(controllers = com.ssafy.backend.follow.controller.FollowController.class,
		excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE,
				classes = { SecurityConfig.class, JwtAuthenticationFilter.class }),
		excludeAutoConfiguration = { OAuth2ClientAutoConfiguration.class, OAuth2ClientWebSecurityAutoConfiguration.class })
@AutoConfigureMockMvc(addFilters = false)
class FollowControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private FollowService followService;

	private static UsernamePasswordAuthenticationToken principal(String email) {
		return new UsernamePasswordAuthenticationToken(
				email, null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
	}

	@Test
	void follow_delegatesTokenSubjectAsFollower() throws Exception {
		when(followService.follow(eq("me@gmail.com"), any(FollowRequest.class)))
				.thenReturn(new FollowResponse("me@gmail.com", "you@gmail.com", true, 13));

		mockMvc.perform(post("/api/user/follow/insert")
						.principal(principal("me@gmail.com"))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"followeeEmail\":\"you@gmail.com\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.data.isFollowing").value(true))
				.andExpect(jsonPath("$.data.followeeFollowerCnt").value(13));

		verify(followService).follow(eq("me@gmail.com"), any(FollowRequest.class));
	}

	@Test
	void follow_self_returns400SelfFollowNotAllowed() throws Exception {
		when(followService.follow(eq("me@gmail.com"), any(FollowRequest.class)))
				.thenThrow(new CustomException(UserErrorCode.SELF_FOLLOW_NOT_ALLOWED));

		mockMvc.perform(post("/api/user/follow/insert")
						.principal(principal("me@gmail.com"))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"followeeEmail\":\"me@gmail.com\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error.code").value("SELF_FOLLOW_NOT_ALLOWED"));
	}

	@Test
	void follow_duplicate_returns409AlreadyFollowing() throws Exception {
		when(followService.follow(eq("me@gmail.com"), any(FollowRequest.class)))
				.thenThrow(new CustomException(UserErrorCode.ALREADY_FOLLOWING));

		mockMvc.perform(post("/api/user/follow/insert")
						.principal(principal("me@gmail.com"))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"followeeEmail\":\"you@gmail.com\"}"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.error.code").value("ALREADY_FOLLOWING"));
	}

	@Test
	void unfollow_returnsIsFollowingFalse() throws Exception {
		when(followService.unfollow(eq("me@gmail.com"), any(FollowRequest.class)))
				.thenReturn(new FollowResponse("me@gmail.com", "you@gmail.com", false, 12));

		mockMvc.perform(post("/api/user/follow/delete")
						.principal(principal("me@gmail.com"))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"followeeEmail\":\"you@gmail.com\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.isFollowing").value(false))
				.andExpect(jsonPath("$.data.followeeFollowerCnt").value(12));
	}

	@Test
	void list_returnsContentWithMeetingCount() throws Exception {
		FollowUserSummary item = new FollowUserSummary(
				"you@gmail.com", "김철수", "철수형", "https://cdn.example.com/a.png", true, false,
				OffsetDateTime.parse("2026-09-07T11:20:31+09:00"), 5);
		when(followService.list(eq("me@gmail.com"), eq("following"), eq(0), eq("me@gmail.com")))
				.thenReturn(new FollowListResponse("following", List.of(item), 0, 20, false));

		mockMvc.perform(get("/api/user/follow/list")
						.param("email", "me@gmail.com")
						.param("type", "following")
						.param("page", "0")
						.principal(principal("me@gmail.com")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.type").value("following"))
				.andExpect(jsonPath("$.data.content[0].name").value("김철수"))
				.andExpect(jsonPath("$.data.content[0].imageUrl").value("https://cdn.example.com/a.png"))
				.andExpect(jsonPath("$.data.content[0].isPublic").value(true))
				.andExpect(jsonPath("$.data.content[0].lastActiveAt").exists())
				.andExpect(jsonPath("$.data.content[0].meetingCnt").value(5))
				.andExpect(jsonPath("$.data.hasNext").value(false));
	}

	@Test
	void list_missingType_returns400InvalidInput() throws Exception {
		mockMvc.perform(get("/api/user/follow/list")
						.param("email", "me@gmail.com")
						.principal(principal("me@gmail.com")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
	}
}
