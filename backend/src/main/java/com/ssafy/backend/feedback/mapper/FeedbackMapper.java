package com.ssafy.backend.feedback.mapper;

import com.ssafy.backend.feedback.dto.FeedbackRow;

public interface FeedbackMapper {

	/** INSERT ... ON CONFLICT (session_id, rank) DO UPDATE ... RETURNING id. */
	long upsert(FeedbackRow row);
}
