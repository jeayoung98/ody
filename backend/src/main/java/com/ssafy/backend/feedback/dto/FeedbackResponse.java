package com.ssafy.backend.feedback.dto;

/** POST /feedback 응답 (정본 §5.1). 같은 (sessionId, rank) 재요청이면 기존 id 가 돌아온다. */
public record FeedbackResponse(long feedbackId) {
}
