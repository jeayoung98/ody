package com.ssafy.backend.music;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.io.Resources;
import org.apache.ibatis.mapping.BoundSql;
import org.apache.ibatis.mapping.MappedStatement;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/**
 * 검색 결과에서 video_id='none' 곡을 빼는 필터가 4단계 전부에 실렸는지 (S15P21A405-344).
 *
 * DB 를 띄우지 않고 MyBatis 가 만든 최종 SQL 문자열만 본다 — 이 저장소엔 실 DB 통합 테스트가 없다
 * (MusicSearchMapperTimeoutTests 와 같은 방식). 단계 하나라도 조건이 빠지면 그 단계로 걸린 곡은
 * "none" 이어도 결과에 그대로 나온다 — 최종 결과만 보는 테스트로는 이 누락을 못 잡는다.
 */
class MusicSearchMapperVideoIdFilterTests {

	private static final String NS = "com.ssafy.backend.music.mapper.MusicSearchMapper";

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
	void findPage_excludesVideoIdNone_inEveryTier() {
		MappedStatement statement = configuration.getMappedStatement(NS + ".findPage");

		Map<String, Object> params = new HashMap<>();
		params.put("q", "love");
		params.put("prefix", "love%");
		params.put("cap", 30L);
		params.put("size", 10);
		params.put("offset", 0L);
		BoundSql boundSql = statement.getBoundSql(params);

		String sql = boundSql.getSql().replaceAll("\\s+", " ");
		assertFilterCount(sql, 4);
	}

	@Test
	void findFilteredPage_excludesVideoIdNone_inArtistTiers() {
		Map<String, Object> params = filteredParams();
		params.put("music", null);
		params.put("musicPrefix", null);

		String sql = configuration.getMappedStatement(NS + ".findFilteredPage")
				.getBoundSql(params).getSql().replaceAll("\\s+", " ");

		assertFilterCount(sql, 2);
	}

	@Test
	void findFilteredPage_excludesVideoIdNone_inCombinedTiers() {
		Map<String, Object> params = filteredParams();
		params.put("music", "love");
		params.put("musicPrefix", "love%");

		String sql = configuration.getMappedStatement(NS + ".findFilteredPage")
				.getBoundSql(params).getSql().replaceAll("\\s+", " ");

		assertFilterCount(sql, 4);
	}

	private static Map<String, Object> filteredParams() {
		Map<String, Object> params = new HashMap<>();
		params.put("artist", "lana del rey");
		params.put("artistPrefix", "lana del rey%");
		params.put("cap", 30L);
		params.put("size", 10);
		params.put("offset", 0L);
		return params;
	}

	private static void assertFilterCount(String sql, int expected) {
		Matcher matches = Pattern.compile("NOT\\s+m\\.is_unplayable").matcher(sql);
		int count = 0;
		while (matches.find()) {
			count++;
		}
		assertEquals(expected, count, "각 검색 tier에 재생 불가 곡 제외 조건이 있어야 한다: " + sql);
	}
}
