package com.ssafy.backend.realtime.mapper;

import org.apache.ibatis.annotations.Param;

/**
 * meeting(마주침 횟수) 접근 (RT-50, S15P21A405-272). PK(user1,user2), user1<user2 사전순.
 * user1·user2 는 user.email FK — 실 유저 없으면 INSERT FK 위반(데모에선 호출 자체가 안 됨/흡수).
 */
public interface MeetingMapper {

	/** (user1,user2) 쌍의 cnt +1. 행 없으면 cnt=1 로 생성(ON CONFLICT UPSERT). */
	int upsertIncrement(@Param("user1") String user1, @Param("user2") String user2);
}
