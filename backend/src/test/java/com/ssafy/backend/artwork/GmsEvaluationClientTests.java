package com.ssafy.backend.artwork;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.ssafy.backend.artwork.evaluation.ArtworkEvaluation;
import com.ssafy.backend.artwork.evaluation.GmsEvaluationClient;
import com.sun.net.httpserver.HttpServer;

/**
 * 모델 답을 점수로 인정하는 규칙 (S15P21A405-563).
 *
 * <p>실제 GMS 를 부르지 않는다. 판정이 <b>본문</b>에서 나오므로 응답을 고정한 스텁 서버를 세운다
 * ({@code VideoIdApiClientTests} 와 같은 방식). 여기서 확인하는 것은 하나다 —
 * <b>모델이 뱉은 값을 검증 없이 점수로 쓰지 않는다</b>(spec FR-006).
 */
class GmsEvaluationClientTests {

	private HttpServer server;
	private GmsEvaluationClient client;
	private final AtomicReference<String> body = new AtomicReference<>("{}");
	private final AtomicInteger status = new AtomicInteger(200);
	private final AtomicReference<String> lastRequestBody = new AtomicReference<>();

	@BeforeEach
	void startStub() throws IOException {
		server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		server.createContext("/v1/chat/completions", exchange -> {
			lastRequestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
			byte[] raw = body.get().getBytes(StandardCharsets.UTF_8);
			exchange.getResponseHeaders().add("Content-Type", "application/json; charset=utf-8");
			exchange.sendResponseHeaders(status.get(), raw.length);
			exchange.getResponseBody().write(raw);
			exchange.close();
		});
		server.start();
		client = newClient("test-key");
	}

	@AfterEach
	void stopStub() {
		server.stop(0);
	}

	private GmsEvaluationClient newClient(String apiKey) {
		return new GmsEvaluationClient(
				"http://127.0.0.1:" + server.getAddress().getPort(),
				apiKey,
				"gpt-4o-mini",
				"low",
				1000,
				2000);
	}

	private Optional<ArtworkEvaluation> evaluate() {
		return client.evaluate(new byte[] {1, 2, 3}, "고양이를 닮았는지 채점하라.", List.of());
	}

	/** content 가 우리가 시킨 JSON 형식일 때만 점수가 된다. */
	@Test
	void returnsScore_whenContentIsExpectedJson() {
		body.set(chatResponse("{\\\"score\\\": 87, \\\"comment\\\": \\\"귀 두 개가 또렷하다\\\"}"));

		Optional<ArtworkEvaluation> result = evaluate();

		assertThat(result).isPresent();
		assertThat(result.get().score()).isEqualTo(87);
		assertThat(result.get().comment()).isEqualTo("귀 두 개가 또렷하다");
		// 응답이 알려준 실제 모델을 남긴다 — 어떤 모델이 준 점수인지 구분할 수 있어야 한다.
		assertThat(result.get().model()).isEqualTo("gpt-4o-mini-2024-07-18");
	}

	@Test
	void sendsImageAsDataUri() {
		body.set(chatResponse("{\\\"score\\\": 50, \\\"comment\\\": \\\"그럭저럭\\\"}"));

		evaluate();

		assertThat(lastRequestBody.get()).contains("data:image/png;base64,");
		assertThat(lastRequestBody.get()).contains("\"detail\":\"low\"");
	}

	/**
	 * 기준 그림은 "기준 그림 N — 점수 S" 라벨과 함께 작품 <b>앞에</b> 실린다. 마지막 이미지가 채점 대상이다.
	 * 진단 v6 에서 이 순서로 보였을 때만 엉망 배치와 난수가 갈렸다.
	 */
	@Test
	void sendsAnchorsBeforeArtwork() {
		body.set(chatResponse("{\\\"score\\\": 40, \\\"comment\\\": \\\"기준 3에 가깝다\\\"}"));

		client.evaluate(new byte[] {9, 9, 9}, "채점하라", List.of(
				new com.ssafy.backend.artwork.evaluation.ArtworkAnchor(new byte[] {1}, 75),
				new com.ssafy.backend.artwork.evaluation.ArtworkAnchor(new byte[] {2}, 5)));

		String sent = lastRequestBody.get();
		int anchor1 = sent.indexOf("기준 그림 1 — 점수 75");
		int anchor2 = sent.indexOf("기준 그림 2 — 점수 5");
		int target = sent.indexOf("채점할 그림:");
		assertThat(anchor1).isPositive();
		assertThat(anchor2).isGreaterThan(anchor1);
		assertThat(target).isGreaterThan(anchor2);
		// 이미지 3장: 기준 2 + 작품 1. 작품이 마지막이다.
		assertThat(sent.split("data:image/png;base64,", -1)).hasSize(4);
		assertThat(sent.lastIndexOf("data:image/png;base64,")).isGreaterThan(target);
	}

	/** 기준 그림이 없으면 라벨도 "채점할 그림:" 도 없다 — 지시문과 작품만 간다. */
	@Test
	void sendsOnlyArtwork_whenNoAnchors() {
		body.set(chatResponse("{\\\"score\\\": 40, \\\"comment\\\": \\\"그럭저럭\\\"}"));

		evaluate();

		assertThat(lastRequestBody.get()).doesNotContain("기준 그림").doesNotContain("채점할 그림:");
		assertThat(lastRequestBody.get().split("data:image/png;base64,", -1)).hasSize(2);
	}

	/** 같은 그림은 같은 점수여야 한다 — temperature 0 이 빠지면 재평가한 사람이 유리해진다. */
	@Test
	void sendsZeroTemperature() {
		body.set(chatResponse("{\\\"score\\\": 50, \\\"comment\\\": \\\"그럭저럭\\\"}"));

		evaluate();

		assertThat(lastRequestBody.get()).contains("\"temperature\":0");
	}

	/** 점수가 범위 밖이면 저장하지 않는다. 120점짜리 작품이 리더보드 1위가 되면 안 된다. */
	@Test
	void returnsEmpty_whenScoreOutOfRange() {
		body.set(chatResponse("{\\\"score\\\": 120, \\\"comment\\\": \\\"최고다\\\"}"));

		assertThat(evaluate()).isEmpty();
	}

	@Test
	void returnsEmpty_whenScoreMissing() {
		body.set(chatResponse("{\\\"comment\\\": \\\"점수를 안 줬다\\\"}"));

		assertThat(evaluate()).isEmpty();
	}

	@Test
	void returnsEmpty_whenCommentBlank() {
		body.set(chatResponse("{\\\"score\\\": 70, \\\"comment\\\": \\\"  \\\"}"));

		assertThat(evaluate()).isEmpty();
	}

	/** 모델이 JSON 대신 말로 답하는 경우. 흔하다. */
	@Test
	void returnsEmpty_whenContentIsNotJson() {
		body.set(chatResponse("이건 고양이 같네요!"));

		assertThat(evaluate()).isEmpty();
	}

	/** 모델의 안전 거부. content 가 null 이고 refusal 만 있다 — 실제로 선 그림에 나왔다(2026-09-22). */
	@Test
	void returnsEmpty_whenModelRefuses() {
		body.set("{\"model\":\"gpt-4o\",\"choices\":[{\"message\":{\"role\":\"assistant\","
				+ "\"content\":null,\"refusal\":\"I'm sorry, I can't assist with that.\"}}]}");

		assertThat(evaluate()).isEmpty();
	}

	@Test
	void returnsEmpty_whenNoChoices() {
		body.set("{\"model\":\"gpt-4o-mini\",\"choices\":[]}");

		assertThat(evaluate()).isEmpty();
	}

	@Test
	void returnsEmpty_whenServerFails() {
		status.set(500);
		body.set("{\"error\":\"boom\"}");

		assertThat(evaluate()).isEmpty();
	}

	/** 키가 없으면 호출 자체를 하지 않는다 — 401 을 받으러 갈 이유가 없다. */
	@Test
	void returnsEmptyWithoutCalling_whenApiKeyBlank() {
		lastRequestBody.set(null);
		GmsEvaluationClient keyless = newClient("");

		assertThat(keyless.evaluate(new byte[] {1}, "채점하라", List.of())).isEmpty();
		assertThat(lastRequestBody.get()).isNull();
	}

	private static String chatResponse(String escapedContent) {
		return "{\"model\":\"gpt-4o-mini-2024-07-18\",\"choices\":[{\"message\":"
				+ "{\"role\":\"assistant\",\"content\":\"" + escapedContent + "\"}}]}";
	}
}
