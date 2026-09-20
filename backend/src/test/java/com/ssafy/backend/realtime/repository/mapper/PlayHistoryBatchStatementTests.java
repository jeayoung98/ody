package com.ssafy.backend.realtime.repository.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.io.Resources;
import org.apache.ibatis.mapping.BoundSql;
import org.apache.ibatis.mapping.MappedStatement;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.ssafy.backend.realtime.dto.play.PlayHistoryRow;

/**
 * 기록이 정말 한 문장으로 나가는지 확인한다.
 *
 * DB 에 붙지 않고 MyBatis 가 만들어 낸 SQL 글자만 본다.
 * 결과가 맞아도 문장 수가 틀릴 수 있는 종류라, 줄 수가 아니라 문장 수와 물음표 개수를 직접 센다.
 */
class PlayHistoryBatchStatementTests {

	private static final String RESOURCE = "mapper/play/PlayHistoryMapper.xml";
	private static final String NAMESPACE = "com.ssafy.backend.realtime.repository.mapper.PlayHistoryMapper";

	private Configuration configuration;

	@BeforeEach
	void loadMapper() throws Exception {
		configuration = new Configuration();
		try (InputStream in = Resources.getResourceAsStream(RESOURCE)) {
			new XMLMapperBuilder(in, configuration, RESOURCE, configuration.getSqlFragments()).parse();
		}
	}

	private BoundSql boundSql(String statement, Object parameter) {
		MappedStatement mappedStatement = configuration.getMappedStatement(NAMESPACE + "." + statement);
		return mappedStatement.getBoundSql(parameter);
	}

	private static List<PlayHistoryRow> rows(int count) {
		List<PlayHistoryRow> rows = new ArrayList<>();
		for (int i = 0; i < count; i++) {
			PlayHistoryRow row = new PlayHistoryRow();
			row.setId(1000L + i);
			row.setMusicId(4927L);
			row.setEmail("rider" + i + "@example.com");
			row.setSource("FOLLOW");
			row.setPlayedMs(i * 1000L);
			rows.add(row);
		}
		return rows;
	}

	private static Map<String, Object> param(String name, Object value) {
		Map<String, Object> parameter = new HashMap<>();
		parameter.put(name, value);
		return parameter;
	}

	private static int countOf(String text, String fragment) {
		int count = 0;
		int at = text.indexOf(fragment);
		while (at >= 0) {
			count++;
			at = text.indexOf(fragment, at + fragment.length());
		}
		return count;
	}

	@Test
	@DisplayName("20명이 따라오면 재생 기록 21줄이 INSERT 한 문장으로 들어간다")
	void insertsTwentyOneRowsInOneStatement() {
		List<PlayHistoryRow> rows = rows(21);

		BoundSql boundSql = boundSql("insertBatch", param("rows", rows));

		assertThat(countOf(boundSql.getSql(), "INSERT INTO play_history")).isEqualTo(1);
		assertThat(boundSql.getSql()).doesNotContain(";");
		// 한 줄에 칸이 5개
		assertThat(boundSql.getParameterMappings()).hasSize(21 * 5);
	}

	@Test
	@DisplayName("여러 줄을 넣을 때 번호를 다시 뽑지 않는다")
	void insertBatchDoesNotUseSelectKey() {
		BoundSql boundSql = boundSql("insertBatch", param("rows", rows(3)));

		assertThat(boundSql.getSql()).doesNotContain("nextval");
	}

	@Test
	@DisplayName("번호는 필요한 개수만큼 한 번에 받아온다")
	void nextIdsUsesGenerateSeries() {
		BoundSql boundSql = boundSql("nextIds", param("count", 21));

		assertThat(boundSql.getSql()).contains("nextval('play_history_id_seq')");
		assertThat(boundSql.getSql()).contains("generate_series");
		assertThat(countOf(boundSql.getSql(), "SELECT")).isEqualTo(1);
	}

	@Test
	@DisplayName("들은 시간도 UPDATE 한 문장으로 적고 사람마다 값이 다르다")
	void updatesPlayedMsInOneStatement() {
		List<PlayHistoryRow> rows = rows(21);

		BoundSql boundSql = boundSql("updatePlayedMsBatch", param("rows", rows));

		assertThat(countOf(boundSql.getSql(), "UPDATE play_history")).isEqualTo(1);
		assertThat(boundSql.getSql()).doesNotContain(";");
		// 한 줄에 번호와 시간 둘
		assertThat(boundSql.getParameterMappings()).hasSize(21 * 2);
	}

	@Test
	@DisplayName("재생수는 인원수만큼 한 번에 더한다")
	void incrementsPlayCountOnce() {
		Map<String, Object> parameter = param("musicId", 4927L);
		parameter.put("delta", 21);

		BoundSql boundSql = boundSql("incrementPlayCntBy", parameter);

		assertThat(countOf(boundSql.getSql(), "UPDATE music")).isEqualTo(1);
		assertThat(boundSql.getSql()).contains("play_cnt + ?");
	}

	@Test
	@DisplayName("혼자여도 같은 문장을 탄다")
	void insertsSingleRowThroughTheSameStatement() {
		BoundSql boundSql = boundSql("insertBatch", param("rows", rows(1)));

		assertThat(countOf(boundSql.getSql(), "INSERT INTO play_history")).isEqualTo(1);
		assertThat(boundSql.getParameterMappings()).hasSize(5);
	}

	@Test
	@DisplayName("기존 단건 경로는 그대로다")
	void singleInsertStillUsesSelectKey() {
		PlayHistoryRow row = rows(1).get(0);

		BoundSql boundSql = boundSql("insert", row);

		assertThat(countOf(boundSql.getSql(), "INSERT INTO play_history")).isEqualTo(1);
		assertThat(boundSql.getParameterMappings()).hasSize(5);
	}
}
