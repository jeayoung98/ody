package com.ssafy.backend.music.videoid;

import java.time.Duration;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import lombok.extern.slf4j.Slf4j;

/**
 * {@link VideoIdLookupPort} 의 HTTP 어댑터 (S15P21A405-312, 프로토타입).
 *
 * <p>{@code data/videoid/api.py} 를 EC2:8001 에 띄운 것을 호출한다. 질의 파라미터는 그쪽
 * {@code GET /videoid} 가 읽는 이름을 그대로 쓴다 — artist·title 은 필수, album·duration 은 선택이다. 검색 응답 경로에서 동기 호출되므로
 * 연결·응답 대기를 짧게 끊어 외부 API 장애가 검색 자체를 물고 늘어지지 않게 한다
 * (검색 질의 자체도 2초 타임아웃이 걸려 있다, S15P21A405-297/304 참고).
 */
@Slf4j
@Component
public class VideoIdApiClient implements VideoIdLookupPort {

	private final RestClient restClient;

	public VideoIdApiClient(@Value("${ody.videoid.base-url}") String baseUrl) {
		SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
		requestFactory.setConnectTimeout(Duration.ofSeconds(2));
		requestFactory.setReadTimeout(Duration.ofSeconds(3));

		this.restClient = RestClient.builder()
				.baseUrl(baseUrl)
				.requestFactory(requestFactory)
				.build();
	}

	@Override
	public Optional<String> lookup(String artist, String title, String album, Integer durationSeconds) {
		try {
			VideoIdApiResponse response = restClient.get()
					.uri(uriBuilder -> {
						uriBuilder.path("/videoid")
								.queryParam("artist", artist)
								.queryParam("title", title);
						// 빈 앨범명은 아예 빼고 보낸다. 서버 기본값이 빈 문자열이라 결과는 같지만,
						// 로그에 남는 URL 만 봐도 "앨범을 몰라서 안 보냈다" 가 드러난다.
						if (album != null && !album.isBlank()) {
							uriBuilder.queryParam("album", album);
						}
						if (durationSeconds != null) {
							uriBuilder.queryParam("duration", durationSeconds);
						}
						return uriBuilder.build();
					})
					.retrieve()
					.body(VideoIdApiResponse.class);

			if (response == null) {
				return Optional.empty();
			}
			if (response.best() != null && response.best().videoId() != null) {
				return Optional.of(response.best().videoId());
			}
			// 후보가 없다. 재생 불가로 확정된 경우에만 판정을 돌려준다 — 검색 실패·일시 오류는
			// 빈 값으로 두어 다음 요청이 다시 시도하게 한다(S15P21A405-454 FR-002·FR-003).
			return response.unplayable() ? Optional.of(VideoIds.UNPLAYABLE) : Optional.empty();
		} catch (RestClientException e) {
			log.warn("[VideoId] 조회 실패 artist={} title={} album={} error={}", artist, title, album, e.getMessage());
			return Optional.empty();
		}
	}
}
