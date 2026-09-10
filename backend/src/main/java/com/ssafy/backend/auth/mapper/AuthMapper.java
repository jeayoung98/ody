package com.ssafy.backend.auth.mapper;

import org.apache.ibatis.annotations.Param;

import com.ssafy.backend.auth.dto.UserAuthDto;

public interface AuthMapper {

	UserAuthDto findByEmail(@Param("email") String email);

	void insert(UserAuthDto user);

	void touchLogin(@Param("email") String email, @Param("imageUrl") String imageUrl);

	void deleteByEmail(@Param("email") String email);
}
