package com.ssafy.backend.artwork.evaluation;

import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.slf4j.Slf4j;

/**
 * {@link ArtworkEvaluationPort} 의 GMS 어댑터 (S15P21A405-563).
 *
 * <p>SSAFY GMS 게이트웨이는 OpenAI 호환 경로를 그대로 프록시한다. 2026-09-22 배포 호스트에서
 * 1×1 PNG 를 {@code image_url} data URI 로 실어 호출해 {@code HTTP 200} 을 확인했다 —
 * 프록시가 이미지 파트를 막지 않는다.
 *
 * <p>모델이 뱉은 값을 그대로 점수로 쓰지 않는다. JSON 이 아니거나 {@code score} 가 0~100 밖이거나
 * 한 줄 평이 비어 있으면 <b>실패로 본다</b>(spec FR-006). 잘못된 점수가 리더보드에 박히는 것보다
 * 다시 평가하는 편이 낫다.
 *
 * <p>호출 실패를 예외로 던지지 않고 {@code Optional.empty()} 로 돌려주는 것은 포트 계약이다 —
 * 스케줄러가 실패를 일반 흐름으로 다루게 하려는 것이다.
 */
@Slf4j
@Component
public class GmsEvaluationClient implements ArtworkEvaluationPort {

	/**
	 * 응답을 JSON 으로 강제한다. OpenAI 의 {@code json_object} 모드는 메시지 어딘가에 "JSON" 이라는
	 * 낱말이 있어야 동작하므로 아래 지시문에 그대로 넣었다 — 지우면 400 이 온다.
	 */
	private static final String INSTRUCTION = """
			%s

			답은 다른 말 없이 JSON 하나로만 하라.
			{"score": 0부터 100 사이 정수, "comment": "한국어 한 줄 평"}
			comment 는 40자 이내로 무엇이 닮았고 무엇이 아쉬운지 적어라.
			""";

	private final RestClient restClient;

	/**
	 * 응답 content 를 한 겹 더 푸는 데만 쓴다. 스프링 빈으로 주입받지 않는 것은 의도다 —
	 * {@code ObjectMapper} 빈이 없는 컨텍스트 구성이 있고, 이 파싱은 애플리케이션 설정에 기댈 이유가 없다.
	 */
	private final ObjectMapper objectMapper = new ObjectMapper();

	private final String model;
	private final String imageDetail;
	private final boolean apiKeyPresent;

	public GmsEvaluationClient(
			@Value("${ody.artwork.gms.base-url}") String baseUrl,
			@Value("${ody.artwork.gms.api-key:}") String apiKey,
			@Value("${ody.artwork.gms.model}") String model,
			@Value("${ody.artwork.gms.image-detail:low}") String imageDetail,
			@Value("${ody.artwork.gms.timeout-connect-ms:3000}") long connectTimeoutMs,
			@Value("${ody.artwork.gms.timeout-read-ms:10000}") long readTimeoutMs) {
		this.model = model;
		this.imageDetail = imageDetail;
		this.apiKeyPresent = apiKey != null && !apiKey.isBlank();

		if (!apiKeyPresent) {
			// 서버를 못 뜨게 하지 않는다 — AI 채점은 기능 하나이고, 키가 없으면 그 작품만 FAILED 로
			// 남으면 된다. 대신 조용히 넘어가지 않도록 시작할 때 한 번 남긴다.
			log.warn("[Artwork] GMS API 키가 비어 있다. 작품 평가는 전부 실패로 기록된다.");
		}

		SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
		requestFactory.setConnectTimeout(Duration.ofMillis(connectTimeoutMs));
		requestFactory.setReadTimeout(Duration.ofMillis(readTimeoutMs));

		this.restClient = RestClient.builder()
				.baseUrl(baseUrl)
				.requestFactory(requestFactory)
				.defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
				.build();
	}

	@Override
	public Optional<ArtworkEvaluation> evaluate(byte[] pngBytes, String themePrompt) {
		if (!apiKeyPresent) {
			return Optional.empty();
		}
		try {
			GmsChatResponse response = restClient.post()
					.uri("/v1/chat/completions")
					.contentType(MediaType.APPLICATION_JSON)
					.body(requestBody(pngBytes, themePrompt))
					.retrieve()
					.body(GmsChatResponse.class);

			return parse(response);
		} catch (RestClientException e) {
			// 본문을 남기지 않는다 — 요청에 이미지 base64 와 키가 섞여 있다(FR-016).
			log.warn("[Artwork] GMS 호출 실패 model={} error={}", model, e.getMessage());
			return Optional.empty();
		}
	}

	private Map<String, Object> requestBody(byte[] pngBytes, String themePrompt) {
		String dataUri = "data:image/png;base64," + Base64.getEncoder().encodeToString(pngBytes);
		return Map.of(
				"model", model,
				"response_format", Map.of("type", "json_object"),
				"messages", List.of(Map.of(
						"role", "user",
						"content", List.of(
								Map.of("type", "text", "text", INSTRUCTION.formatted(themePrompt)),
								Map.of("type", "image_url",
										"image_url", Map.of("url", dataUri, "detail", imageDetail))))));
	}

	/** 모델 답을 믿지 않는다. 형식·범위를 통과한 것만 점수로 인정한다. */
	private Optional<ArtworkEvaluation> parse(GmsChatResponse response) {
		if (response == null || response.choices() == null || response.choices().isEmpty()) {
			log.warn("[Artwork] GMS 응답에 choices 가 없다 model={}", model);
			return Optional.empty();
		}
		GmsChatResponse.Message message = response.choices().get(0).message();
		if (message == null || message.content() == null || message.content().isBlank()) {
			log.warn("[Artwork] GMS 응답 content 가 비었다 model={}", model);
			return Optional.empty();
		}

		try {
			ScoreAndComment parsed = objectMapper.readValue(message.content(), ScoreAndComment.class);
			if (parsed.score() == null || parsed.score() < 0 || parsed.score() > 100) {
				log.warn("[Artwork] GMS 점수가 범위 밖이다 score={}", parsed.score());
				return Optional.empty();
			}
			if (parsed.comment() == null || parsed.comment().isBlank()) {
				log.warn("[Artwork] GMS 한 줄 평이 비었다");
				return Optional.empty();
			}
			String actualModel = response.model() == null ? model : response.model();
			return Optional.of(new ArtworkEvaluation(parsed.score(), parsed.comment().strip(), actualModel));
		} catch (Exception e) {
			log.warn("[Artwork] GMS 응답을 JSON 으로 읽지 못했다 error={}", e.getMessage());
			return Optional.empty();
		}
	}

	/** 모델이 답하기로 한 형식. */
	private record ScoreAndComment(Integer score, String comment) {
	}
}
