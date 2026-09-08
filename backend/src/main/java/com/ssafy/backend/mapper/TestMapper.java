package com.ssafy.backend.mapper;

import java.util.List;

import com.ssafy.backend.dto.TestDto;

public interface TestMapper {

	List<TestDto> selectAll();
}
