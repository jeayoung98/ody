package com.ssafy.backend.feedback.service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;
import com.ssafy.backend.feedback.dto.AnsweredRow;
import com.ssafy.backend.feedback.dto.FeedbackRequest;
import com.ssafy.backend.feedback.dto.FeedbackResponse;
import com.ssafy.backend.feedback.dto.FeedbackRow;
import com.ssafy.backend.feedback.mapper.FeedbackMapper;
import com.ssafy.backend.music.retrieval.ServingRules;

import lombok.extern.slf4j.Slf4j;

/**
 * 탐색 설문 저장 (S15P21A405-289). 형식 검증은 DTO 애노테이션, 필드 간 규칙은 여기서.
 * 응답 시점의 번들·임계값을 행에 찍어 두어 규칙을 바꾼 뒤 전후 비교가 되게 한다.
 * 같은 사람이 같은 문항에 두 번 답하지 못한다 (S15P21A405-346) — 두 번째는 저장하지 않고 첫 답의 id 를 돌려준다.
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
		// ponytail: SELECT 후 INSERT 라 같은 사람의 동시 요청 둘은 둘 다 들어갈 수 있다. 사람 키가 OR 라 UNIQUE 로 못 막는다. 집계에서 거른다.
		if (userEmail != null || row.getAnonymousId() != null) {
			Long answered = feedbackMapper.findAnsweredId(row);
			if (answered != null) {
				log.info("[Feedback] 이미 답한 문항, 저장 생략 mode={} anchor={} music={} id={}",
						request.mode(), request.anchorMusicId(), request.musicId(), answered);
				return new FeedbackResponse(answered);
			}
		}
		FeedbackResponse response = new FeedbackResponse(feedbackMapper.upsert(row));
		log.info("[Feedback] 응답 저장 완료 mode={} skipped={} verdict={}",
				request.mode(), request.skipped(), request.verdict());
		return response;
	}

	/** 사람 기준으로 답한 문항. 둘 다 null 이면 누구인지 모르니 400. */
	public List<AnsweredRow> answered(String userEmail, String anonymousId) {
		if (userEmail == null && anonymousId == null) {
			throw new CustomException(GlobalErrorCode.INVALID_INPUT);
		}
		return feedbackMapper.findAnswered(userEmail, anonymousId);
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
