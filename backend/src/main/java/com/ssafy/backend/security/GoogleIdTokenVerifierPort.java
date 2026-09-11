package com.ssafy.backend.security;

import java.util.Optional;

/**
 * 구글 idToken 검증 (S15P21A405-122, AUTH-01 본안). 실제 검증은 GoogleIdTokenVerifierAdapter가
 * Google 공식 라이브러리(GoogleIdTokenVerifier)로 서명·발급자·audience·만료를 확인한다.
 * 인터페이스로 분리해 AuthService 단위 테스트에서 실제 네트워크 호출 없이 mock한다.
 */
public interface GoogleIdTokenVerifierPort {

	/**
	 * 검증 성공 시 클레임을 담아 반환. 서명 위조, audience 불일치, 만료 등은 Optional.empty로
	 * 뭉뚱그린다(호출자가 OAUTH_FAILED로 변환) — 실패 사유별로 분기할 필요가 없기 때문.
	 */
	Optional<GoogleIdentity> verify(String idToken);

	record GoogleIdentity(String email, boolean emailVerified, String name, String imageUrl) {
	}
}
