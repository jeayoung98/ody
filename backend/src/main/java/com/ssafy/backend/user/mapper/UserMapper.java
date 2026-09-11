package com.ssafy.backend.user.mapper;

import org.apache.ibatis.annotations.Param;

import com.ssafy.backend.user.dto.UserProfileRow;

public interface UserMapper {

	UserProfileRow findProfileByEmail(@Param("email") String email);

	void updateTutorialCompleted(@Param("email") String email);

	void updateProfile(@Param("email") String email, @Param("nickname") String nickname,
			@Param("imageUrl") String imageUrl);
}
