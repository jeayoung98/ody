package com.ssafy.backend.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SignupRequestDto(
		@NotBlank @Email String email,
		@NotBlank @Size(min = 8, max = 72) String password,
		@NotBlank String nickname) {
}
