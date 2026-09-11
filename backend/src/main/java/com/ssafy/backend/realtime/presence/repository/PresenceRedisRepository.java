package com.ssafy.backend.realtime.presence.repository;

import java.util.List;
import java.util.Set;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Repository;

import lombok.RequiredArgsConstructor;

/**
 * ★ Redis 키 조립은 반드시 이 Repository 를 거친다 — 키 문자열은 여기에만 존재(data-model §1).
 * presence:user:{email} · presence:expiry(ZSET) · listeners:{musicId} ·
 * active-song:cell:{layer}:{x}:{y} · cell:usercount:{layer}(Hash).
 *
 * 골격 단계: 빈 배선(Redis 템플릿·Lua 스크립트 주입)만. 메서드 본문은 내부작업(R-04).
 */
@Repository
@RequiredArgsConstructor
public class PresenceRedisRepository {

	private final StringRedisTemplate redis;
	private final DefaultRedisScript<List> presencePlayScript;
	private final DefaultRedisScript<List> presenceLeaveScript;
	private final DefaultRedisScript<Long> usercountRecountScript;

	/** 하트비트 — presence:expiry ZADD XX(만료 시각 갱신). */
	public void touch(String email, long ttlMs) {
		throw new UnsupportedOperationException("TODO(내부작업)");
	}

	/** Sweep 대상 — 만료 시각 경과 email 목록. */
	public Set<String> expired(long nowMs) {
		throw new UnsupportedOperationException("TODO(내부작업)");
	}

	/** 곡 변경 원자 갱신(presence-play.lua). @return 진입 직전 신곡 청취자 목록(만남 판정용), old 불일치면 null. */
	public List<String> applyPlay(String email, Long oldMusicId, long newMusicId,
			int layer, double x, double y, int cellX, int cellY, long epoch, long ttlMs) {
		throw new UnsupportedOperationException("TODO(내부작업)");
	}

	/** 이탈 정리 원자(presence-leave.lua). @return 제거된 {musicId, layer, cellX, cellY} 또는 빈. */
	public List<String> applyLeave(String email, long epoch) {
		throw new UnsupportedOperationException("TODO(내부작업)");
	}

	/** 셀 인원수 재검증(usercount-recount.lua). @return 불일치 셀 수. */
	public long recount(long layer) {
		throw new UnsupportedOperationException("TODO(내부작업)");
	}

	public Long currentLayer(String email) {
		throw new UnsupportedOperationException("TODO(내부작업)");
	}
}
