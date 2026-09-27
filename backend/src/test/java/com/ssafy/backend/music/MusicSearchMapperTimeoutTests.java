package com.ssafy.backend.music;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.InputStream;

import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.io.Resources;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/**
 * 검색 질의에 타임아웃이 실제로 실렸는지 (S15P21A405-297).
 *
 * 이 확인이 따로 있는 이유는, 타임아웃이 빠져도 **아무것도 깨지지 않기** 때문이다.
 * 결과는 같고 다른 테스트도 통과한다. 단지 느린 질의가 커넥션을 27초씩 잡아
 * 풀(5개)을 고갈시키고 지도·곡상세까지 같이 죽는다. 그 회귀를 잡을 곳이 여기뿐이다.
 */
class MusicSearchMapperTimeoutTests {

	private static final String NS = "com.ssafy.backend.music.mapper.MusicSearchMapper";

	/** 풀 5개 / 다른 API 의 커넥션 획득 한도 5초 기준으로 고른 값. XML 주석에 근거가 있다. */
	private static final int TIMEOUT_SECONDS = 2;

	private static Configuration configuration;

	@BeforeAll
	static void parseMapperXml() throws Exception {
		configuration = new Configuration();
		String path = "mapper/music/MusicSearchMapper.xml";
		try (InputStream in = Resources.getResourceAsStream(path)) {
			new XMLMapperBuilder(in, configuration, path, configuration.getSqlFragments()).parse();
		}
	}

	@Test
	void findPage_hasQueryTimeout() {
		// 관련성 4단계 질의. 색인이 없거나 색인 표현식과 어긋나면 단계마다 660만 행을 훑는다.
		assertEquals(TIMEOUT_SECONDS, configuration.getMappedStatement(NS + ".findPage").getTimeout());
	}

	@Test
	void findFilteredPage_hasQueryTimeout() {
		assertEquals(TIMEOUT_SECONDS, configuration.getMappedStatement(NS + ".findFilteredPage").getTimeout());
	}
}
