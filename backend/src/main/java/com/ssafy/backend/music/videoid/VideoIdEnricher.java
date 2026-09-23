package com.ssafy.backend.music.videoid;

import java.util.Optional;

import org.springframework.stereotype.Component;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * videoId 가 없는 곡만 외부 videoid API(EC2:8001) 로 실시간 조회해 채운다(S15P21A405-312, 프로토타입).
 *
 * <p>검색·곡상세·주변탐색·경로탐색이 이 하나를 공유한다 — 넷 다 결국
 * {@code MusicSearchReaderAdapter}/{@code MusicDetailReaderAdapter}/{@code JourneyTrackReaderAdapter}
 * 를 거쳐 같은 {@code music} 행을 읽고 쓴다. spec 006 FR-006(길이·embeddable 검증)은 적용하지 않는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class VideoIdEnricher {

	/**
	 * videoId 해결 구간 (S15P21A405-572).
	 *
	 * <p>곡 상세가 느릴 때 그것이 좌표 조회(HNSW 콜드, 실측 350ms)인지 이 외부 호출인지 가를 근거가
	 * 없어서 넣었다. 상세 응답은 이 호출을 <b>동기로 기다리고</b>, {@code VideoIdApiClient} 의
	 * 타임아웃이 connect 2초 + read 3초라 최악 5초가 그대로 응답 시간이 된다.
	 *
	 * <p>{@code outcome} 태그가 <b>외부 API 를 탔는지</b>를 가른다 — {@code cached} 만 DB 값으로 끝난
	 * 요청이고 나머지 셋({@code found}·{@code unplayable}·{@code miss})은 전부 외부를 다녀왔다.
	 * 따라서 <b>{@code cached} 아닌 비율이 곧 외부 호출 비율</b>이고, 그 값이 개선 여부의 판단 근거다.
	 * {@code miss} 는 후보를 못 찾았거나 외부 API 가 실패·타임아웃한 경우다 — 이 둘은 다음 요청이
	 * 다시 시도하므로(S15P21A405-454) 같은 곡이 계속 비용을 문다.
	 */
	private static final String RESOLVE_TIMER = "ody.videoid.resolve";

	private final VideoIdLookupPort lookupPort;
	private final VideoIdWriterPort writerPort;
	private final MeterRegistry meterRegistry;

	/**
	 * @param existingVideoId DB 에 이미 저장된 값. {@code null} 이 아니면 그대로 반환하고 호출하지 않는다.
	 *                        {@link VideoIds#UNPLAYABLE} 도 확정된 판정이므로 다시 묻지 않는다 —
	 *                        읽기 어댑터가 {@code is_unplayable} 을 이 값으로 번역해 넘긴다
	 * @param album           앨범명. 있으면 외부 resolver 가 검색어를 하나 더 만들고 공식 Art Track 을
	 *                        알아본다. 모르면 {@code null}
	 * @param durationSeconds 원곡 길이(초). 알면 매칭 정확도가 오른다. 모르면 {@code null}
	 * @return 확정된 videoId. 후보를 못 찾았거나 외부 API 가 실패하면 {@code null}
	 */
	public String resolve(long musicId, String artist, String title, String album, String existingVideoId,
			Integer durationSeconds) {
		Timer.Sample sample = Timer.start(meterRegistry);
		if (existingVideoId != null) {
			record(sample, "cached");
			return existingVideoId;
		}

		// 실패·타임아웃일 때야말로 이 계측이 찾는 경우다. finally 로 그 경로에서도 반드시 남긴다.
		String outcome = "miss";
		try {
			Optional<String> videoId = lookupPort.lookup(artist, title, album, durationSeconds);
			if (videoId.isPresent()) {
				String id = videoId.get();
				if (VideoIds.UNPLAYABLE.equals(id)) {
					outcome = "unplayable";
					writerPort.markUnplayable(musicId);
					log.info("[VideoId] 재생 불가 확정 musicId={}", musicId);
				} else {
					outcome = "found";
					writerPort.save(musicId, id);
					log.info("[VideoId] 실시간 매핑 완료 musicId={}, videoId={}", musicId, id);
				}
			}
			return videoId.orElse(null);
		} finally {
			record(sample, outcome);
		}
	}

	private void record(Timer.Sample sample, String outcome) {
		sample.stop(meterRegistry.timer(RESOLVE_TIMER, "outcome", outcome));
	}
}
