package com.ssafy.backend.music.videoid;

import java.util.Optional;

import org.springframework.stereotype.Component;

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

	private final VideoIdLookupPort lookupPort;
	private final VideoIdWriterPort writerPort;

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
		if (existingVideoId != null) {
			return existingVideoId;
		}

		Optional<String> videoId = lookupPort.lookup(artist, title, album, durationSeconds);
		videoId.ifPresent(id -> {
			if (VideoIds.UNPLAYABLE.equals(id)) {
				writerPort.markUnplayable(musicId);
				log.info("[VideoId] 재생 불가 확정 musicId={}", musicId);
			} else {
				writerPort.save(musicId, id);
				log.info("[VideoId] 실시간 매핑 완료 musicId={}, videoId={}", musicId, id);
			}
		});
		return videoId.orElse(null);
	}
}
