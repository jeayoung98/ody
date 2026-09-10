package com.ssafy.backend.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record GoogleLoginRequestDto(@NotBlank String idToken) {
}
