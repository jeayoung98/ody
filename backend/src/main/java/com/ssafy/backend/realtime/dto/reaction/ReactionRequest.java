package com.ssafy.backend.realtime.dto.reaction;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * 반응 전송 요청 (SOCIAL-02).
 *
 * reactionKey 는 프론트 이모지 세트의 키(fire, board, friend …)다. 목록은 프론트 상수가 소유하므로
 * 서버는 형식만 검사하고 받는 쪽이 모르는 키는 받는 쪽이 무시한다.
 *
 * @param toEmail 받는 사람
 * @param reactionKey 이모지 키. 소문자·밑줄 32자 이내
 */
public record ReactionRequest(
		@NotBlank String toEmail,
		@NotBlank @Pattern(regexp = "^[a-z_]{1,32}$") String reactionKey) {
}
