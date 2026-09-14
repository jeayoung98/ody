package com.ssafy.backend.music.videoid;

/** videoId 저장 port (S15P21A405-312, 프로토타입). */
public interface VideoIdWriterPort {

	void save(long musicId, String videoId);
}
