package com.ssafy.backend.music.videoid;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.InputStream;

import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.io.Resources;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/**
 * videoId 쓰기 두 문장의 경합 가드 (S15P21A405-568).
 *
 * <p>DB 를 띄우지 않고 MyBatis 가 만든 최종 SQL 문자열만 본다({@code UnplayablePurgeMapperSqlTests}
 * 와 같은 방식). <b>단위 테스트는 매퍼를 mock 으로 두므로 이 가드가 빠진 것을 잡지 못한다</b> —
 * 가드가 사라지면 재생 가능한 곡이 재생 불가로 굳고 삭제 배치가 그것을 지운다.
 */
class VideoIdMapperSqlTests {

	private static final String NS = "com.ssafy.backend.music.mapper.VideoIdMapper";

	private static Configuration configuration;

	@BeforeAll
	static void parseMapperXml() throws Exception {
		configuration = new Configuration();
		String path = "mapper/music/VideoIdMapper.xml";
		try (InputStream in = Resources.getResourceAsStream(path)) {
			new XMLMapperBuilder(in, configuration, path, configuration.getSqlFragments()).parse();
		}
	}

	private static String sql(String id) {
		return configuration.getMappedStatement(NS + "." + id)
				.getBoundSql(null).getSql().replaceAll("\\s+", " ");
	}

	/**
	 * videoId 를 저장하면 재생 불가 플래그가 풀려야 한다.
	 *
	 * <p>경합에서 이쪽이 나중에 오는 경우다. 되돌리지 않으면 실제 videoId 를 가진 곡이
	 * 플래그를 달고 남는다(2026-09-22 운영에 2건).
	 */
	@Test
	void savingVideoIdClearsUnplayableFlag() {
		String sql = sql("updateVideoId");

		assertTrue(sql.matches("(?i).*is_unplayable\\s*=\\s*false.*"),
				"updateVideoId 가 is_unplayable 을 되돌리지 않는다: " + sql);
	}

	/**
	 * 재생 불가 확정은 videoId 가 없을 때만이다.
	 *
	 * <p>경합에서 이쪽이 나중에 오는 경우다. 가드가 없으면 먼저 저장된 실제 videoId 를
	 * 이기고 곡을 삭제 대상으로 만든다.
	 */
	@Test
	void markingUnplayableSkipsSongsThatAlreadyHaveVideoId() {
		String sql = sql("markUnplayable");

		assertTrue(sql.matches("(?i).*AND\\s+video_id\\s+IS\\s+NULL.*"),
				"markUnplayable 에 video_id IS NULL 가드가 없다: " + sql);
	}
}
