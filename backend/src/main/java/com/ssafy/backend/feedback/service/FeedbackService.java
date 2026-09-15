package com.ssafy.backend.feedback.service;

import org.springframework.stereotype.Service;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;
import com.ssafy.backend.feedback.dto.FeedbackRequest;
import com.ssafy.backend.feedback.dto.FeedbackResponse;
import com.ssafy.backend.feedback.dto.FeedbackRow;
import com.ssafy.backend.feedback.mapper.FeedbackMapper;
import com.ssafy.backend.music.retrieval.ServingRules;

import lombok.extern.slf4j.Slf4j;

/**
 * 탐색 설문 저장 (S15P21A405-289). 형식 검증은 DTO 애노테이션, 필드 간 규칙은 여기서.
 * 응답 시점의 번들·임계값을 행에 찍어 두어 규칙을 바꾼 뒤 전후 비교가 되게 한다.
 */
@Slf4j
@Service
public class FeedbackService {

	private final FeedbackMapper feedbackMapper;
	private final ServingRules servingRules;

	public FeedbackService(FeedbackMapper feedbackMapper, ServingRules servingRules) {
		this.feedbackMapper = feedbackMapper;
		this.servingRules = servingRules;
	}

	/** @param userEmail 로그인 주체. 비로그인은 null */
	public FeedbackResponse save(FeedbackRequest request, String userEmail) {
		validate(request);
		FeedbackRow row = new FeedbackRow();
		row.setSessionId(request.sessionId().toString());
		row.setAnonymousId(request.anonymousId() == null ? null : request.anonymousId().toString());
		row.setMode(request.mode());
		row.setRank(request.rank());
		row.setAnchorMusicId(request.anchorMusicId());
		row.setTargetMusicId(request.targetMusicId());
		row.setPrevMusicId(request.prevMusicId());
		row.setMusicId(request.musicId());
		row.setVerdict(request.verdict());
		row.setReason(request.reason());
		row.setListenedSec(request.listenedSec());
		row.setSkipped(Boolean.TRUE.equals(request.skipped()));
		row.setUserEmail(userEmail);
		row.setBundle(servingRules.bundle());
		row.setRules(rulesSnapshot(servingRules));
		FeedbackResponse response = new FeedbackResponse(feedbackMapper.upsert(row));
		log.info("[Feedback] 응답 저장 완료 mode={} skipped={} verdict={}",
				request.mode(), request.skipped(), request.verdict());
		return response;
	}

	static void validate(FeedbackRequest r) {
		boolean journey = "journey".equals(r.mode());
		if (journey && r.targetMusicId() == null) {
			throw new CustomException(GlobalErrorCode.INVALID_INPUT);   // 여정은 도착곡 필수
		}
		if (!journey && (r.targetMusicId() != null || r.prevMusicId() != null)) {
			throw new CustomException(GlobalErrorCode.INVALID_INPUT);   // 주변 탐색엔 도착곡·앞 역 없음
		}
		if ((r.reason() != null) != Boolean.FALSE.equals(r.verdict())) {
			throw new CustomException(GlobalErrorCode.INVALID_INPUT);   // 이유는 부정 응답에만, 부정 응답엔 반드시
		}
	}

	/** 후처리 임계값 스냅샷. postprocess_rules.json 해시 대신 값 자체를 적는다 — 읽으면 바로 뜻이 보인다. */
	static String rulesSnapshot(ServingRules s) {
		return "dup=%s,cap=%d,far=%s,len=%d-%d".formatted(
				s.tauDup(), s.artistCap(), s.tauFar(), s.lengthMinS(), s.lengthMaxS());
	}
}
