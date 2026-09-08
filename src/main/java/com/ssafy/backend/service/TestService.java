package com.ssafy.backend.service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.ssafy.backend.dto.TestDto;
import com.ssafy.backend.mapper.TestMapper;

@Service
public class TestService {

	private final TestMapper testMapper;

	public TestService(TestMapper testMapper) {
		this.testMapper = testMapper;
	}

	public List<TestDto> getAll() {
		return testMapper.selectAll();
	}
}
