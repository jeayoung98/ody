package com.ssafy.backend.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * password/nickname의 형식·길이 검증은 여기서 하지 않고 {@code AuthService}에서 한다.
 * INVALID_PASSWORD_FORMAT/INVALID_NICKNAME_LENGTH처럼 케이스별 에러 코드를 내려주기 위함
 * (Bean Validation은 전부 뭉뚱그려 INVALID_INPUT으로만 처리됨).
 */
public record SignupRequestDto(
		@NotBlank @Email String email,
		@NotBlank String password,
		@NotBlank String nickname) {
}
