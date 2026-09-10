package com.ssafy.backend.security;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.Collections;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
public class GoogleIdTokenVerifierAdapter implements GoogleIdTokenVerifierPort {

	private final GoogleIdTokenVerifier verifier;

	public GoogleIdTokenVerifierAdapter(
			@Value("${spring.security.oauth2.client.registration.google.client-id}") String googleClientId) {
		this.verifier = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), GsonFactory.getDefaultInstance())
				.setAudience(Collections.singletonList(googleClientId))
				.build();
	}

	@Override
	public Optional<GoogleIdentity> verify(String idToken) {
		try {
			GoogleIdToken googleIdToken = verifier.verify(idToken);
			if (googleIdToken == null) {
				log.warn("[Auth] 구글 idToken 검증 실패 (서명/발급자/audience/만료 불일치)");
				return Optional.empty();
			}

			GoogleIdToken.Payload payload = googleIdToken.getPayload();
			boolean emailVerified = Boolean.TRUE.equals(payload.getEmailVerified());
			String name = (String) payload.get("name");
			String imageUrl = (String) payload.get("picture");

			return Optional.of(new GoogleIdentity(payload.getEmail(), emailVerified, name, imageUrl));
		} catch (GeneralSecurityException | IOException | IllegalArgumentException e) {
			log.warn("[Auth] 구글 idToken 검증 중 오류: {}", e.getMessage());
			return Optional.empty();
		}
	}
}
