package com.ssafy.backend.follow.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.ssafy.backend.follow.dto.FollowUserRow;

public interface FollowMapper {

	int insert(@Param("followerEmail") String followerEmail, @Param("followeeEmail") String followeeEmail);

	int delete(@Param("followerEmail") String followerEmail, @Param("followeeEmail") String followeeEmail);

	boolean exists(@Param("followerEmail") String followerEmail, @Param("followeeEmail") String followeeEmail);

	int countFollowers(@Param("email") String email);

	int countFollowings(@Param("email") String email);

	/**
	 * 대상을 팔로우하는 사람들. requesterEmail 기준으로 isFollowing·meetingCnt 를 채운다.
	 * limit 은 (size + 1) 로 넘겨 hasNext 를 판단한다.
	 */
	List<FollowUserRow> findFollowers(@Param("email") String email, @Param("requesterEmail") String requesterEmail,
			@Param("limit") int limit, @Param("offset") int offset);

	/**
	 * 대상이 팔로우하는 사람들. 나머지는 findFollowers 와 같다.
	 */
	List<FollowUserRow> findFollowings(@Param("email") String email, @Param("requesterEmail") String requesterEmail,
			@Param("limit") int limit, @Param("offset") int offset);
}
