package com.ssafy.backend.music.videoid;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.sun.net.httpserver.HttpServer;

/**
 * 외부 응답을 판정으로 번역하는 규칙 (S15P21A405-454).
 *
 * <p>실제 videoid 서비스는 띄우지 않는다. 대신 응답 본문을 고정한 스텁 서버를 세운다 — 판정이
 * <b>본문</b>에서 나오기 때문이다. 서비스는 검색 실패도 HTTP 오류가 아니라 {@code 200 +
 * retryable:true} 로 돌려주므로 상태 코드만으로는 가릴 수 없다({@code data/videoid/api.py}).
 */
class VideoIdApiClientTests {

	private HttpServer server;
	private VideoIdApiClient client;
	private final AtomicReference<String> body = new AtomicReference<>("{}");
	private final AtomicReference<Integer> status = new AtomicReference<>(200);
	/** 마지막 요청의 질의 문자열. 무엇을 실어 보냈는지는 본문이 아니라 여기에만 남는다. */
	private final AtomicReference<String> lastQuery = new AtomicReference<>();

	@BeforeEach
	void startStub() throws IOException {
		server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		server.createContext("/videoid", exchange -> {
			lastQuery.set(exchange.getRequestURI().getQuery());
			byte[] raw = body.get().getBytes(StandardCharsets.UTF_8);
			exchange.getResponseHeaders().add("Content-Type", "application/json; charset=utf-8");
			exchange.sendResponseHeaders(status.get(), raw.length);
			exchange.getResponseBody().write(raw);
			exchange.close();
		});
		server.start();
		client = new VideoIdApiClient("http://127.0.0.1:" + server.getAddress().getPort());
	}

	@AfterEach
	void stopStub() {
		server.stop(0);
	}

	private Optional<String> lookup() {
		return client.lookup("Bastille", "Give Me the Future", "Give Me the Future", 215);
	}

	@Test
	void returnsVideoId_whenCandidateFound() {
		body.set("{\"best\":{\"videoId\":\"ugffpCgWBqs\",\"confidence\":\"verified\"},"
				+ "\"playable\":true,\"retryable\":false}");

		assertEquals(Optional.of("ugffpCgWBqs"), lookup());
	}

	/** 후보 없음 + 재시도 불가 = 재생 불가 확정. 이 값이 그대로 저장 판정이 된다. */
	@Test
	void returnsUnplayable_whenNoCandidateAndNotRetryable() {
		body.set("{\"best\":null,\"playable\":false,\"retryable\":false,\"status\":\"no_candidate\"}");

		assertEquals(Optional.of(VideoIds.UNPLAYABLE), lookup());
	}

	/** 검색 실패는 재생 불가가 아니다. 굳히면 되돌릴 경로가 없다(FR-002). */
	@Test
	void returnsEmpty_whenRetryable() {
		body.set("{\"best\":null,\"playable\":false,\"retryable\":true,\"status\":\"retry_pending\"}");

		assertTrue(lookup().isEmpty());
	}

	/** 서비스가 실패를 200 으로 돌려주는 경로 — 상태 코드로는 가릴 수 없다. */
	@Test
	void returnsEmpty_whenServiceReportsFailureWithHttp200() {
		body.set("{\"best\":null,\"playable\":false,\"status\":\"retry_pending\","
				+ "\"reason\":\"TimeoutError\",\"retryable\":true}");

		assertTrue(lookup().isEmpty());
	}

	/** 판정 필드를 못 읽으면 기록하지 않는다(FR-003). 응답 형식이 바뀌어도 오판하지 않는다. */
	@Test
	void returnsEmpty_whenVerdictFieldsMissing() {
		body.set("{\"best\":null,\"status\":\"unknown_shape\"}");

		assertTrue(lookup().isEmpty());
	}

	/** 모르는 필드가 늘어도 판정은 그대로다(FR-007). */
	@Test
	void ignoresUnknownFields() {
		body.set("{\"best\":{\"videoId\":\"ugffpCgWBqs\",\"score\":0.98,\"newField\":123},"
				+ "\"playable\":true,\"retryable\":false,\"cacheHit\":true,\"checkedAt\":\"2026-09-18\"}");

		assertEquals(Optional.of("ugffpCgWBqs"), lookup());
	}

	/**
	 * FR-006 — 판정 라벨로 저장을 가르지 않는다.
	 *
	 * <p>서비스는 엄격 검증({@code verified})과 유사도 추측({@code best_guess})을 구분해 내려주지만,
	 * 저장 정책이 "둘 다 저장" 이라 백엔드는 그 라벨을 읽지 않는다(2026-09-18 결정). 나중에 누군가
	 * 라벨로 분기를 넣으면 이 테스트가 깨진다 — 그때는 결정을 먼저 뒤집어야 한다.
	 */
	@Test
	void treatsBestGuessTheSameAsVerified() {
		body.set("{\"best\":{\"videoId\":\"ugffpCgWBqs\",\"confidence\":\"verified\",\"score\":null},"
				+ "\"playable\":true,\"retryable\":false}");
		Optional<String> verified = lookup();

		body.set("{\"best\":{\"videoId\":\"ugffpCgWBqs\",\"confidence\":\"best_guess\",\"score\":0.83},"
				+ "\"playable\":true,\"retryable\":false}");
		Optional<String> bestGuess = lookup();

		assertEquals(Optional.of("ugffpCgWBqs"), verified);
		assertEquals(verified, bestGuess);
	}

	/**
	 * 앨범명을 알면 실어 보낸다. resolver 가 "artist title album" 검색을 한 번 더 돌리고
	 * 설명란으로 공식 Art Track 을 알아보는 재료다({@code data/videoid/resolver.py}).
	 */
	@Test
	void sendsAlbum_whenKnown() {
		body.set("{\"best\":null,\"playable\":false,\"retryable\":true}");

		client.lookup("Bastille", "Give Me the Future", "Give Me the Future", 215);

		// 퍼센트 인코딩이든 + 든 서버가 받는 값은 같다. 인코딩 방식이 아니라 값을 본다.
		String query = URLDecoder.decode(lastQuery.get(), StandardCharsets.UTF_8);
		assertTrue(query.contains("album=Give Me the Future"), query);
	}

	/** 앨범을 모르면 파라미터 자체를 빼고 보낸다 — 빈 값을 보내는 것과 구분된다. */
	@Test
	void omitsAlbum_whenUnknown() {
		body.set("{\"best\":null,\"playable\":false,\"retryable\":true}");

		client.lookup("Bastille", "Give Me the Future", null, 215);
		assertFalse(lastQuery.get().contains("album="), lastQuery.get());

		client.lookup("Bastille", "Give Me the Future", "   ", 215);
		assertFalse(lastQuery.get().contains("album="), lastQuery.get());
	}

	/** artist·title 이 비면 서비스가 400 을 준다. 클라이언트 오류라 기록하지 않는다. */
	@Test
	void returnsEmpty_onHttpError() {
		status.set(400);
		body.set("{\"best\":null,\"error\":\"artist_and_title_required\"}");

		assertTrue(lookup().isEmpty());
	}
}
