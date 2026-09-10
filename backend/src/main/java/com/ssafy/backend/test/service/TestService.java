package com.ssafy.backend.test.service;

import java.util.List;

import org.neo4j.driver.Driver;
import org.neo4j.driver.Session;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import com.ssafy.backend.test.dto.TestDto;
import com.ssafy.backend.test.mapper.TestMapper;

@Service
public class TestService {

	private final TestMapper testMapper;
	private final StringRedisTemplate redisTemplate;
	private final Driver neo4jDriver;

	public TestService(TestMapper testMapper, StringRedisTemplate redisTemplate, Driver neo4jDriver) {
		this.testMapper = testMapper;
		this.redisTemplate = redisTemplate;
		this.neo4jDriver = neo4jDriver;
	}

	public List<TestDto> getAll() {
		return testMapper.selectAll();
	}

	public String pingRedis() {
		redisTemplate.opsForValue().set("test:ping", "pong");
		return redisTemplate.opsForValue().get("test:ping");
	}

	public String pingNeo4j() {
		try (Session session = neo4jDriver.session()) {
			return session.run("RETURN 'pong' AS result").single().get("result").asString();
		}
	}
}
