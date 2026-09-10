package com.ssafy.backend.user;

/**
 * 닉네임 길이 규칙. 회원가입(AuthService)과 닉네임 사용 가능 여부 조회(UserAvailabilityService)가
 * 같은 기준을 써야 하므로 한 곳에 둔다.
 */
public final class NicknamePolicy {

	public static final int MIN_LENGTH = 2;
	public static final int MAX_LENGTH = 20;

	private NicknamePolicy() {
	}

	public static boolean isValidLength(String nickname) {
		int length = nickname.length();
		return length >= MIN_LENGTH && length <= MAX_LENGTH;
	}
}
