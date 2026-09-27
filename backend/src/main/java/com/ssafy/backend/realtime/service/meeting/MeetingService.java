package com.ssafy.backend.realtime.service.meeting;

import java.time.Duration;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.ssafy.backend.realtime.repository.mapper.MeetingMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 마주침 기록 (RT-50). 재생 진입 시 '같은 레이어·같은 곡을 듣던 사람들'과의 만남을 세어 준다.
 * play 응답을 막지 않도록 @Async 로 뒤에서 처리한다(RealtimeTaskConfig 에서 @EnableAsync).
 * 같은 두 사람은 3분에 한 번만 센다. 재생 버튼을 연달아 눌러 횟수를 올리는 것을 막는다.
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
	 * 한 쌍씩 3분 안에 이미 셌는지 보고, 아니면 횟수를 1 올린다.
	 */
	@Async
	public void recordMeetings(String actorEmail, List<String> others) {
		if (others == null || others.isEmpty()) {
			return;
		}
		for (String other : others) {
			recordPair(actorEmail, other);
		}
	}

	/**
	 * 내린 사람들과 그 곡에 원래 있던 사람들의 만남을 기록한다.
	 *
	 * 따라가는 동안은 만남이 아니다. 따라다닌 결과이지 서로 찾아온 것이 아니기 때문이다.
	 * 내리는 순간 보통 사용자가 되므로, 그 곡에 원래 있던 사람과는 만남이 성립한다.
	 *
	 * 선단에 속한 사람은 여기서 뺀다. 부르는 쪽에 맡기면 한쪽만 고쳐지는 사고가 난다.
	 * 한 명이 내릴 때와 선단이 통째로 흩어질 때가 이 함수 하나를 같이 쓴다.
	 *
	 * 따라가기 직전에 이미 같은 곡에 있었다면 그때 이미 셌다. 3분 안이면 여기서 다시 세지 않는다.
	 *
	 * @param dismounted 내린 사람들
	 * @param residents 그 곡에 있던 사람들. 내린 사람이 지도에 다시 들어가기 전에 찍은 명단이어야 한다
	 * @param fleetMembers 인솔자와 따라가던 사람들
	 */
	@Async
	public void recordOnDismount(
			List<String> dismounted, Collection<String> residents, Collection<String> fleetMembers) {
		if (dismounted == null || dismounted.isEmpty() || residents == null || residents.isEmpty()) {
			return;
		}
		Set<String> outsiders = new LinkedHashSet<>(residents);
		if (fleetMembers != null) {
			outsiders.removeAll(fleetMembers);
		}
		outsiders.removeAll(dismounted);
		outsiders.remove(null);
		if (outsiders.isEmpty()) {
			return;
		}
		for (String rider : dismounted) {
			for (String outsider : outsiders) {
				recordPair(rider, outsider);
			}
		}
	}

	/**
	 * 두 사람의 만남 한 건. 3분 안에 이미 센 사이면 세지 않는다.
	 *
	 * 같은 클래스 안에서 부르므로 @Async 가 걸리지 않는다. 부르는 쪽이 이미 뒤에서 도는 자리다.
	 */
	private void recordPair(String actorEmail, String other) {
		String cooldownKey = null;
		try {
			if (other == null || other.equals(actorEmail)) {
				return; // 자기 자신 방어(applyPlay 가 이미 제외하지만)
			}
			boolean actorFirst = actorEmail.compareTo(other) <= 0;
			String user1 = actorFirst ? actorEmail : other;
			String user2 = actorFirst ? other : actorEmail; // 사전순으로 정렬

			// 같은 두 사람은 3분에 한 번만 센다. 여기서 만드는 키가 3분 뒤에 저절로 사라진다.
			//   키를 새로 만들었으면(true) 3분 안에 센 적이 없다는 뜻 → 센다.
			//   이미 있으면(false) 3분 안에 이미 셌다는 뜻 → 건너뛴다.
			String key = COOLDOWN_PREFIX + user1 + ":" + user2;
			Boolean fresh = redis.opsForValue().setIfAbsent(
					key, "1", Duration.ofSeconds(cooldownSec));
			if (!Boolean.TRUE.equals(fresh)) {
				return;
			}
			// 우리가 만든 잠금이다. 세지 못하면 우리가 풀어야 한다.
			cooldownKey = key;

			meetingMapper.upsertIncrement(user1, user2);
		} catch (Exception e) {
			// 세지 못했으니 3분 잠금도 풀어 준다. 그대로 두면 다시 만나도 3분 동안 안 센다.
			releaseCooldown(cooldownKey);
			// 실 유저 없으면 FK 위반(데모/테스트). 한 쌍 실패가 나머지·재생을 막지 않게 로그만(email 미기록).
			log.warn("만남 기록 실패 — 스킵", e);
		}
	}

	/** 세지 못한 쌍의 3분 잠금을 푼다. 이것까지 실패하면 그 쌍만 3분을 기다린다. */
	private void releaseCooldown(String cooldownKey) {
		if (cooldownKey == null) {
			return;
		}
		try {
			redis.delete(cooldownKey);
		} catch (Exception e) {
			log.warn("만남 잠금 해제 실패 — 그 쌍은 3분 뒤에 다시 셀 수 있다", e);
		}
	}

	/**
	 * 나와 특정 상대가 지금까지 몇 번 마주쳤는지. 페어는 저장 규칙과 동일하게 사전순 정렬해서 조회.
	 * 한 번도 안 만났으면 0.
	 */
	public int countWith(String me, String other) {
		String u1 = me.compareTo(other) < 0 ? me : other;
		String u2 = me.compareTo(other) < 0 ? other : me;
		Integer cnt = meetingMapper.findCount(u1, u2);
		return cnt == null ? 0 : cnt;
	}

}
