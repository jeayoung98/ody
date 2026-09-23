package com.ssafy.backend.music.videoid;

import org.springframework.stereotype.Repository;

import com.ssafy.backend.music.mapper.VideoIdMapper;

/** {@link VideoIdWriterPort} 의 MyBatis 어댑터 (S15P21A405-312, 프로토타입). */
@Repository
public class VideoIdWriterAdapter implements VideoIdWriterPort {

	private final VideoIdMapper mapper;

	public VideoIdWriterAdapter(VideoIdMapper mapper) {
		this.mapper = mapper;
	}

	@Override
	public void save(long musicId, String videoId) {
		mapper.updateVideoId(musicId, videoId);
	}

	@Override
	public boolean markUnplayable(long musicId) {
		return mapper.markUnplayable(musicId) == 1;
	}
}
