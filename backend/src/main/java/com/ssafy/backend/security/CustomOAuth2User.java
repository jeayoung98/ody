package com.ssafy.backend.security;

import java.util.Collection;
import java.util.List;
import java.util.Map;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.user.OAuth2User;

import com.ssafy.backend.auth.dto.UserAuthDto;

public class CustomOAuth2User implements OAuth2User {

	private final UserAuthDto user;
	private final Map<String, Object> attributes;

	public CustomOAuth2User(UserAuthDto user, Map<String, Object> attributes) {
		this.user = user;
		this.attributes = attributes;
	}

	public UserAuthDto getUser() {
		return user;
	}

	@Override
	public Map<String, Object> getAttributes() {
		return attributes;
	}

	@Override
	public Collection<? extends GrantedAuthority> getAuthorities() {
		return List.of(new SimpleGrantedAuthority("ROLE_USER"));
	}

	@Override
	public String getName() {
		return user.getEmail();
	}
}
