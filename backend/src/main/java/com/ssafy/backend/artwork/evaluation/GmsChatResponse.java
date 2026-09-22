package com.ssafy.backend.artwork.evaluation;

import java.util.List;

/**
 * GMS(OpenAI 호환) chat completions 응답 중 <b>우리가 읽는 부분만</b>.
 *
 * <p>모르는 필드는 Jackson 기본 설정이 무시한다(Spring Boot 는 {@code FAIL_ON_UNKNOWN_PROPERTIES}
 * 를 끈다) — {@code usage}·{@code system_fingerprint} 등을 여기 옮겨 적지 않는다.
 */
public record GmsChatResponse(String model, List<Choice> choices) {

	public record Choice(Message message) {
	}

	/**
	 * {@code content} 는 우리가 JSON 으로 답하라고 시킨 문자열이다. 한 번 더 파싱해야 한다.
	 *
	 * <p>{@code refusal} 은 모델이 답을 거부했을 때만 채워지고 그때 {@code content} 는 null 이다.
	 * 2026-09-22 진단에서 선 그림 하나에 실제로 나왔다("I'm sorry, I can't assist…") — 이유를 로그에
	 * 남기지 않으면 "왜 FAILED 인지" 를 알 수 없다.
	 */
	public record Message(String content, String refusal) {
	}
}
