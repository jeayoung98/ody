package com.ssafy.backend.user.mapper;

import org.apache.ibatis.annotations.Param;

import com.ssafy.backend.user.dto.UserProfileRow;

public interface UserMapper {

	UserProfileRow findProfileByEmail(@Param("email") String email);

	void updateTutorialCompleted(@Param("email") String email);

	void updateNickname(@Param("email") String email, @Param("nickname") String nickname);

	void updateImageUrl(@Param("email") String email, @Param("imageUrl") String imageUrl);

	void updateIsPublic(@Param("email") String email, @Param("isPublic") boolean isPublic);

	int countDistinctPlayedMusic(@Param("email") String email);

	int countDiscoveredMusic(@Param("email") String email);

	/** 마지막으로 재생한 곡의 id. 기록이 없으면 {@code null}. */
	Long findLastPlayedMusicId(@Param("email") String email);
}
