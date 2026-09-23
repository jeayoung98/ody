package com.ssafy.backend.config;

import java.util.Arrays;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.ssafy.backend.security.CustomAuthenticationEntryPoint;
import com.ssafy.backend.security.CustomOAuth2UserService;
import com.ssafy.backend.security.JwtAuthenticationFilter;
import com.ssafy.backend.security.OAuth2SuccessHandler;

import lombok.RequiredArgsConstructor;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

	private final CustomOAuth2UserService customOAuth2UserService;
	private final OAuth2SuccessHandler oAuth2SuccessHandler;
	private final JwtAuthenticationFilter jwtAuthenticationFilter;
	private final CustomAuthenticationEntryPoint customAuthenticationEntryPoint;

	@Value("${app.cors.allowed-origins}")
	private String allowedOrigins;

	@Bean
	public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
		http
				.csrf(AbstractHttpConfigurer::disable)
				.cors(cors -> cors.configurationSource(corsConfigurationSource()))
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.authorizeHttpRequests(auth -> auth
						// 정본 §0.7: 로그인/토큰 재발급/OAuth 리다이렉트·콜백/헬스체크만 공개, 나머지는 전부 인증 필요(기본 거부, S15P21A405-33).
						.requestMatchers(
								"/api/auth/signup", "/api/auth/login", "/api/auth/login/google",
								"/api/auth/exchange", "/api/auth/reissue",
								"/api/users/nickname-available",
								"/api/user/images/**",   // 업로드된 프로필 이미지 정적 서빙 [S15P21A405-426]
								"/api/feedback",   // 탐색 설문은 비로그인도 보낸다 [S15P21A405-289]
								"/api/feedback/answered",   // 답한 문항 조회는 인증 선택 (정본 §5.2, S15P21A405-346)
								"/api/music/report",   // 음원 신고는 비로그인도 보낸다 [S15P21A405-388]
								// 작품 감상은 인증 선택 — 제출·좋아요·삭제는 인증 필요다 [S15P21A405-563].
								// 셋 다 GET 만 매핑돼 있어 쓰기 경로가 열리지 않는다.
								"/api/artwork/round/current", "/api/artwork/leaderboard", "/api/artwork/detail",
								"/oauth2/authorization/**", "/login/oauth2/code/**",
								// 소켓 핸드셰이크. 이 단계에는 토큰이 실리지 않는다 —
								// 인증은 소켓이 열린 뒤 STOMP CONNECT 에서 WebSocketAuthInterceptor 가 한다.
								"/ws/**",
								"/actuator/health", "/api/hello", "/actuator/prometheus",
								// 수동 테스트 페이지. 머지 전에 이 줄과 파일을 함께 지운다 [S15P21A405-82]
								"/__realtime-test.html",
								"/api/swagger-ui.html", "/api/swagger-ui/**", "/api/v3/api-docs/**")
						.permitAll()
						.anyRequest().authenticated())
				.oauth2Login(oauth2 -> oauth2
						.userInfoEndpoint(userInfo -> userInfo.userService(customOAuth2UserService))
						.successHandler(oAuth2SuccessHandler))
				.exceptionHandling(exception -> exception.authenticationEntryPoint(customAuthenticationEntryPoint))
				.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

		return http.build();
	}

	@Bean
	public PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}

	private CorsConfigurationSource corsConfigurationSource() {
		CorsConfiguration configuration = new CorsConfiguration();
		configuration.setAllowedOrigins(
				Arrays.stream(allowedOrigins.split(",")).map(String::trim).toList());
		configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
		configuration.setAllowedHeaders(List.of("*"));
		configuration.setAllowCredentials(true);

		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/**", configuration);
		return source;
	}
}
