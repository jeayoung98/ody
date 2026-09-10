package com.ssafy.backend.security;

import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import com.ssafy.backend.auth.dto.UserAuthDto;
import com.ssafy.backend.auth.mapper.AuthMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

	private final AuthMapper authMapper;

	@Override
	public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
		OAuth2User oAuth2User = super.loadUser(userRequest);

		String email = oAuth2User.getAttribute("email");
		String name = oAuth2User.getAttribute("name");
		String imageUrl = oAuth2User.getAttribute("picture");

		UserAuthDto user = authMapper.findByEmail(email);

		if (user == null) {
			// nickname은 UNIQUE라 구글 표시 이름을 그대로 넣으면 중복 충돌이 나므로,
			// 온보딩(tutorial_completed) 단계에서 사용자가 직접 정하도록 비워둔다.
			user = new UserAuthDto();
			user.setEmail(email);
			user.setName(name);
			user.setImageUrl(imageUrl);
			authMapper.insert(user);
			log.info("[OAuth2] 신규 회원가입 완료 email={}", email);
		} else {
			authMapper.touchLogin(email, imageUrl);
			user.setImageUrl(imageUrl);
			log.info("[OAuth2] 기존 회원 로그인 email={}", email);
		}

		return new CustomOAuth2User(user, oAuth2User.getAttributes());
	}
}
