package com.ssafy.backend.feedback.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.ssafy.backend.feedback.dto.AnsweredRow;
import com.ssafy.backend.feedback.dto.FeedbackRow;

public interface FeedbackMapper {

	/** INSERT ... ON CONFLICT (session_id, rank) DO UPDATE ... RETURNING id. */
	long upsert(FeedbackRow row);

	/** 같은 사람이 다른 세션에서 같은 문항에 이미 남긴 답(verdict NOT NULL)의 id. 없으면 null. */
	Long findAnsweredId(FeedbackRow row);

	/** 사람 기준으로 답한 문항 전부. userEmail·anonymousId 둘 중 하나만 있어도 된다. */
	List<AnsweredRow> findAnswered(@Param("userEmail") String userEmail, @Param("anonymousId") String anonymousId);
}
