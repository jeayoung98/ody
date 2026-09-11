package com.ssafy.backend.user.service;

import org.springframework.stereotype.Service;

import com.ssafy.backend.auth.mapper.AuthMapper;
import com.ssafy.backend.common.AuthErrorCode;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.user.NicknamePolicy;

import lombok.RequiredArgsConstructor;

/**
 * 회원가입 전 닉네임 사용 가능 여부 조회. "user" 테이블 조회는 AuthMapper.existsByNickname을 그대로 재사용한다
 * (AuthService.signup의 중복 검사와 같은 쿼리·같은 길이 규칙).
 */
@Service
@RequiredArgsConstructor
public class UserAvailabilityService {

	private final AuthMapper authMapper;

	public boolean isNicknameAvailable(String nickname) {
		if (!NicknamePolicy.isValidLength(nickname)) {
			throw new CustomException(AuthErrorCode.INVALID_NICKNAME_LENGTH);
		}
		return !authMapper.existsByNickname(nickname);
	}
}
