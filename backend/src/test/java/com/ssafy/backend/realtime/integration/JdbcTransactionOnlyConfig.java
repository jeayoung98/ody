package com.ssafy.backend.realtime.integration;

import javax.sql.DataSource;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.PlatformTransactionManager;

/**
 * 거래는 관계형 DB 로 묶는다.
 *
 * 이 앱에는 그래프 DB 연결도 같이 있어서, 그냥 두면 거래를 그쪽이 맡는다.
 * 시나리오 시험은 그래프 DB 를 띄우지 않으므로 재생처럼 거래로 묶인 일이 전부 실패한다.
 */
@TestConfiguration
class JdbcTransactionOnlyConfig {

	@Bean
	@Primary
	PlatformTransactionManager scenarioTransactionManager(DataSource dataSource) {
		return new DataSourceTransactionManager(dataSource);
	}
}
