package com.ssafy.backend.realtime.service.reaction;

import java.time.Duration;
import java.time.Instant;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.realtime.dto.reaction.ReactionPayload;
import com.ssafy.backend.realtime.dto.reaction.ReactionRequest;
import com.ssafy.backend.realtime.error.RealtimeErrorCode;
import com.ssafy.backend.realtime.message.RealtimeMessageService;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.message.WebSocketDestination;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 반응 보내기 (SOCIAL-02·SOCIAL-04).
 *
 * 대상은 주변 사람 목록과 같은 기준 — 나와 같은 층에 서 있는 사람이다(S15P21A405-582).
 * 서로 보이는 관계라 "내 목록에 뜬 사람" 과 "자기 목록에 내가 뜬 사람" 이 같다.
 *
 * 기록은 남기지 않는다. 그 자리에서 받는 사람 개인 큐로 넘기고 끝이다.
 * 같은 사람에게 연달아 보내는 것은 Redis 키 하나로 막는다. MeetingService 의 3분 표시와 같은 방식이다.
 */
@Slf4j
@Service
@Profile("realtime")
@RequiredArgsConstructor
public class ReactionService {

	private static final String COOLDOWN_PREFIX = "reaction-cd:"; // reaction-cd:{보낸이}:{받는이}

	private final PresenceRedisRepository presenceRedisRepository;
	private final RealtimeMessageService realtimeMessageService;
	private final StringRedisTemplate redis;

	@Value("${realtime.reaction.cooldown-sec:5}")
	private long cooldownSec;

	/**
	 * 반응을 보낸다.
	 *
	 * @param fromEmail 보내는 사람
	 * @param request 받는 사람과 이모지 키
	 * @throws CustomException 자기 자신(400) · 내가 접속 중이 아님(422) · 상대가 내 층에 없음(409) · 쿨다운(429)
	 */
	public void send(String fromEmail, ReactionRequest request) {
		String toEmail = request.toEmail();

		// 1. 자기 자신은 Redis 를 볼 것도 없이 막는다.
		if (fromEmail.equals(toEmail)) {
			throw new CustomException(RealtimeErrorCode.REACTION_SELF);
		}

		// 2. 내가 층 위에 없으면 접속 문제다. 따라가기와 같은 코드로 돌려서 받는 쪽이 재연결로 푼다.
		Long myLayer = presenceRedisRepository.currentLayer(fromEmail);
		if (myLayer == null) {
			log.warn("반응 거부 reason=SENDER_NOT_PLACED");
			throw new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
		}

		// 3. 상대가 내 층에 있어야 한다. 접속이 없거나 다른 층이면 주변 사람이 아니다.
		if (!myLayer.equals(presenceRedisRepository.currentLayer(toEmail))) {
			throw new CustomException(RealtimeErrorCode.REACTION_NOT_NEARBY);
		}

		// 4. 같은 사람에게는 쿨다운에 한 번. 키를 새로 만들었으면(true) 보낼 수 있다.
		//    방향이 있다 — 내가 그에게 보낸 것과 그가 나에게 보낸 것은 따로 센다.
		Boolean fresh = redis.opsForValue().setIfAbsent(
				COOLDOWN_PREFIX + fromEmail + ":" + toEmail, "1", Duration.ofSeconds(cooldownSec));
		if (!Boolean.TRUE.equals(fresh)) {
			throw new CustomException(RealtimeErrorCode.REACTION_COOLDOWN);
		}

		// 5. 받는 사람 개인 큐로 넘긴다.
		realtimeMessageService.sendToUser(toEmail, WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.REACTION,
				new ReactionPayload(fromEmail, request.reactionKey(), Instant.now().toString()));
	}
}
