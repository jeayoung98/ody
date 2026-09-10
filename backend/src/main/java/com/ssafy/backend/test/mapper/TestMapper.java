package com.ssafy.backend.test.mapper;

import java.util.List;

import com.ssafy.backend.test.dto.TestDto;

public interface TestMapper {

	List<TestDto> selectAll();
}
