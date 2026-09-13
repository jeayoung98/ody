package com.ssafy.backend.realtime.meeting;

import java.time.Duration;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.ssafy.backend.realtime.mapper.MeetingMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 마주침 기록 (RT-50). 재생 진입 시 '같은 레이어·같은 곡을 듣던 사람들'과의 만남을 세어 준다.
 * play 응답을 막지 않도록 @Async 로 뒤에서 처리한다(RealtimeAsyncConfig 에서 @EnableAsync).
 * 3분 쿨다운: 같은 두 사람이 3분 안에 또 만나면 세지 않는다(Redis TTL 키로 판정).
 * user1·user2 는 user.email FK 라 실 유저가 있어야 실제로 쌓인다(무로그인 데모에선 realtime 프로파일 자체가 꺼져 호출 안 됨).
 */
@Slf4j
@Service
@Profile("realtime")
@RequiredArgsConstructor
public class MeetingService {

	private static final String COOLDOWN_PREFIX = "meeting-cd:";

	private final MeetingMapper meetingMapper;
	private final StringRedisTemplate redis;

	@Value("${realtime.meeting.cooldown-sec:180}")
	private long cooldownSec;

	/**
	 * actorEmail 과 others(같은 레이어·같은 곡 청취자들) 각각의 만남을 기록한다.
	 * 각 쌍마다 3분 쿨다운을 먼저 확인하고, 쿨다운이 아니면 cnt +1.
	 */
	@Async
	public void recordMeetings(String actorEmail, List<String> others) {
		if (others == null || others.isEmpty()) {
			return;
		}
		for (String other : others) {
			try {
				if (other == null || other.equals(actorEmail)) {
					continue; // 자기 자신 방어(applyPlay 가 이미 제외하지만)
				}
				boolean actorFirst = actorEmail.compareTo(other) <= 0;
				String user1 = actorFirst ? actorEmail : other;
				String user2 = actorFirst ? other : actorEmail; // 사전순으로 정렬

				// 3분 쿨다운: 키가 새로 생기면(setIfAbsent=true) 최근 3분 내 첫 만남 → 카운트.
				//            이미 있으면(false) 쿨다운 중 → 건너뜀.
				Boolean fresh = redis.opsForValue().setIfAbsent(
						COOLDOWN_PREFIX + user1 + ":" + user2, "1", Duration.ofSeconds(cooldownSec));
				if (!Boolean.TRUE.equals(fresh)) {
					continue;
				}

				meetingMapper.upsertIncrement(user1, user2);
			} catch (Exception e) {
				// 실 유저 없으면 FK 위반(데모/테스트). 한 쌍 실패가 나머지·재생을 막지 않게 로그만(email 미기록).
				log.warn("만남 기록 실패 — 스킵", e);
			}
		}
	}
}
