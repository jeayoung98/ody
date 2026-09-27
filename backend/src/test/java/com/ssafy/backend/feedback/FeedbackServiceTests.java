package com.ssafy.backend.feedback;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;
import com.ssafy.backend.feedback.dto.FeedbackRequest;
import com.ssafy.backend.feedback.dto.FeedbackRow;
import com.ssafy.backend.feedback.mapper.FeedbackMapper;
import com.ssafy.backend.feedback.service.FeedbackService;
import com.ssafy.backend.music.retrieval.ServingRules;

/** 설문 저장 서비스 유닛 (S15P21A405-289). 필드 간 규칙과 번들·임계값 스냅샷만 본다. */
class FeedbackServiceTests {

	private final FeedbackMapper mapper = mock(FeedbackMapper.class);
	private final ServingRules rules = new ServingRules("v2.1-pca16", 1.6624, 3, 4.912, 30, 1200, 10.7);
	private final FeedbackService service = new FeedbackService(mapper, rules);
	private final UUID session = UUID.randomUUID();
	private final UUID anon = UUID.randomUUID();

	@BeforeEach
	void noPriorAnswer() {
		when(mapper.findAnsweredId(any())).thenReturn(null);   // Mockito 기본값은 0L 이라 "이미 답함" 으로 읽힌다
	}

	private FeedbackRequest nearby(Boolean verdict, String reason) {
		return new FeedbackRequest(session, anon, "nearby", 3, 1L, null, null, 55L, verdict, reason, 42, false);
	}

	@Test
	void save_stampsBundleRulesAndUser() {
		when(mapper.upsert(any())).thenReturn(7L);

		long id = service.save(nearby(false, "mood"), "me@gmail.com").feedbackId();

		ArgumentCaptor<FeedbackRow> captor = ArgumentCaptor.forClass(FeedbackRow.class);
		verify(mapper).upsert(captor.capture());
		FeedbackRow row = captor.getValue();
		assertThat(id).isEqualTo(7L);
		assertThat(row.getBundle()).isEqualTo("v2.1-pca16");
		assertThat(row.getRules()).isEqualTo("dup=1.6624,cap=3,far=4.912,len=30-1200");
		assertThat(row.getUserEmail()).isEqualTo("me@gmail.com");
		assertThat(row.getSessionId()).isEqualTo(session.toString());
		assertThat(row.getAnonymousId()).isEqualTo(anon.toString());
	}

	@Test
	void save_samePersonSameQuestion_returnsFirstIdWithoutInsert() {
		when(mapper.findAnsweredId(any())).thenReturn(3L);

		assertThat(service.save(nearby(true, null), null).feedbackId()).isEqualTo(3L);

		verify(mapper, never()).upsert(any());
	}

	@Test
	void save_nobodyIdentified_skipsDedupe() {
		when(mapper.upsert(any())).thenReturn(4L);

		assertThat(service.save(new FeedbackRequest(session, null, "nearby", 1, 1L, null, null, 55L, true, null, null, null), null)
				.feedbackId()).isEqualTo(4L);

		verify(mapper, never()).findAnsweredId(any());
	}

	@Test
	void answered_needsEmailOrAnonymousId() {
		assertThatThrownBy(() -> service.answered(null, null))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(GlobalErrorCode.INVALID_INPUT);
		service.answered(null, anon.toString());
		verify(mapper).findAnswered(null, anon.toString());
	}

	@Test
	void save_anonymousAndNoAnswer_allowed() {
		when(mapper.upsert(any())).thenReturn(1L);
		assertThat(service.save(nearby(null, null), null).feedbackId()).isEqualTo(1L);
	}

	@Test
	void validate_reasonIffNegativeVerdict() {
		assertInvalid(nearby(false, null));   // 부정 응답엔 이유 필수
		assertInvalid(nearby(true, "dup"));
		assertInvalid(nearby(null, "dup"));
	}

	@Test
	void validate_journeyNeedsTarget_nearbyForbidsTargetAndPrev() {
		assertInvalid(new FeedbackRequest(session, null, "journey", 1, 1L, null, 1L, 55L, true, null, null, null));
		assertInvalid(new FeedbackRequest(session, null, "nearby", 1, 1L, 9L, null, 55L, true, null, null, null));
		when(mapper.upsert(any())).thenReturn(2L);
		assertThat(service.save(
				new FeedbackRequest(session, null, "journey", 1, 1L, 9L, 1L, 55L, true, null, null, null), null)
				.feedbackId()).isEqualTo(2L);
	}

	private void assertInvalid(FeedbackRequest request) {
		assertThatThrownBy(() -> service.save(request, null))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(GlobalErrorCode.INVALID_INPUT);
	}
}
