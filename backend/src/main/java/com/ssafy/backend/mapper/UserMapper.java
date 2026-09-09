package com.ssafy.backend.mapper;

import org.apache.ibatis.annotations.Param;

import com.ssafy.backend.dto.UserDto;

public interface UserMapper {

	UserDto findByEmail(@Param("email") String email);

	void insert(UserDto user);

	void touchLogin(@Param("email") String email, @Param("imageUrl") String imageUrl);

	void deleteByEmail(@Param("email") String email);
}
