package com.ssafy.backend.realtime.service.ride;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository.CloseResult;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository.ViewportMeta;
import com.ssafy.backend.realtime.service.nearby.NearbyPeopleService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 따라가기를 시작할 때 그 사람이 혼자 보던 것들을 끊는다.
 *
 * 끊지 않으면 따라가는 동안 두 동네 소식이 한꺼번에 들어온다.
 * 인솔자 화면은 옮겨 받는데, 자기가 탑승 전에 보던 자리의 알림도 계속 오기 때문이다.
 * 화면 알림은 자리를 지켜보는 명단으로, 주변사람 알림은 곡을 지켜보는 명단으로 나가는데
 * 둘 다 탑승해도 그대로 남아 있다.
 */
@Slf4j
@Service
@Profile("realtime")
@RequiredArgsConstructor
public class RideSubscriptionService {

	private final ViewportRedisRepository viewportRedisRepository; // 화면 자리 구독
	private final NearbyPeopleService nearbyPeopleService; // 주변사람 곡 구독

	/**
	 * 혼자 보던 화면과 주변사람 구독을 닫는다.
	 * 열어 둔 게 없으면 아무것도 하지 않는다.
	 *
	 * @param riderEmail 따라가기 시작한 사람
	 * @param epoch 지금 접속 번호
	 */
	public void closeOwnViews(String riderEmail, long epoch) {
		closeOwnScreen(riderEmail);
		// 주변사람은 열어 둔 게 없어도 호출이 안전하다. 지울 게 없으면 그냥 실패로 끝난다.
		nearbyPeopleService.close(riderEmail, epoch);
	}

	/**
	 * 혼자 보던 화면 구독을 닫는다.
	 *
	 * 닫으려면 그 화면을 연 접속 번호와 요청 순번이 필요해서, 저장된 값을 읽어 그대로 넘긴다.
	 */
	private void closeOwnScreen(String riderEmail) {
		ViewportMeta meta = viewportRedisRepository.findMeta(riderEmail).orElse(null);
		if (meta == null) {
			return;
		}
		CloseResult result = viewportRedisRepository.closeCurrentScreen(
				riderEmail, meta.epoch(), meta.requestSeq());
		log.info("[Ride] 따라가기 시작 — 혼자 보던 화면 정리 결과={}", result);
	}
}
