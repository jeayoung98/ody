package com.ssafy.backend.realtime.repository.redis;

import java.util.List;
import java.util.Set;

import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Repository;

import com.ssafy.backend.realtime.dto.ride.PlaybackState;

import lombok.RequiredArgsConstructor;

/**
 * 따라가기 Redis 키는 여기서만 만든다.
 * ride:captain:{따라가는 사람}(Hash) · ride:riders:{인솔자}(Set) · ride:playback:{인솔자}(Hash).
 *
 * 앞의 두 키는 서로 뒤집은 관계라 항상 같이 바뀌어야 한다. 그 변경은 Lua 가 맡고
 * 여기에는 읽기와 재생 정보 저장만 둔다.
 */
@Repository
@Profile("realtime")
@RequiredArgsConstructor
public class RideRedisRepository {

	private static final String CAPTAIN_PREFIX = "ride:captain:"; // 내가 따라가는 사람
	private static final String RIDERS_PREFIX = "ride:riders:"; // 나를 따라오는 사람들
	private static final String PLAYBACK_PREFIX = "ride:playback:"; // 그룹이 지금 트는 곡

	/**
	 * 재생 스냅샷을 통째로 바꾸고 새 순번을 돌려준다.
	 * 순번 증가와 값 저장이 갈라지면 읽는 쪽이 새 순번에 옛 값을 볼 수 있어 한 번에 처리한다.
	 */
	private static final DefaultRedisScript<Long> SAVE_PLAYBACK_SCRIPT = new DefaultRedisScript<>(
			"local snapshotSeq = redis.call('HINCRBY', KEYS[1], 'snapshotSeq', 1) "
					+ "redis.call('HSET', KEYS[1], 'musicId', ARGV[1], 'state', ARGV[2], "
					+ "'positionMs', ARGV[3], 'updatedAt', ARGV[4]) "
					+ "return snapshotSeq",
			Long.class);

	private final StringRedisTemplate redis;

	/** 내가 따라가는 사람과 그때의 접속 번호. */
	public record Ride(String captainEmail, long epoch) {
	}

	/**
	 * 그룹이 지금 트는 곡.
	 * positionMs 는 updatedAt 당시의 재생 위치. 지금 위치는 읽는 쪽에서 더해서 구한다.
	 * snapshotSeq 는 이 값이 몇 번째로 바뀐 것인지. 소켓 접속 번호(epoch)나 봉투 seq 와는 다르다.
	 */
	public record PlaybackSnapshot(long musicId, PlaybackState state, long positionMs, long updatedAt, long snapshotSeq) {
	}

	/** 내가 누구를 따라가는지 읽는다. 안 따라가면 null. */
	public Ride findRide(String riderEmail) {
		List<Object> v = redis.opsForHash().multiGet(CAPTAIN_PREFIX + riderEmail, List.of("captain", "epoch"));
		if (v == null || v.get(0) == null || v.get(1) == null) {
			return null;
		}
		return new Ride(v.get(0).toString(), Long.parseLong(v.get(1).toString()));
	}

	/** 나를 따라오는 인원 수. */
	public int riderCount(String captainEmail) {
		Long n = redis.opsForSet().size(RIDERS_PREFIX + captainEmail);
		return n == null ? 0 : n.intValue();
	}

	/** 나를 따라오는 사람들. 없으면 빈 집합. */
	public Set<String> riders(String captainEmail) {
		Set<String> res = redis.opsForSet().members(RIDERS_PREFIX + captainEmail);
		return res != null ? res : Set.of();
	}

	/** 그룹이 지금 트는 곡을 읽는다. 아직 없으면 null. */
	public PlaybackSnapshot findPlayback(String captainEmail) {
		List<Object> v = redis.opsForHash().multiGet(PLAYBACK_PREFIX + captainEmail,
				List.of("musicId", "state", "positionMs", "updatedAt", "snapshotSeq"));
		if (v == null || v.get(0) == null || v.get(4) == null) {
			return null;
		}
		return new PlaybackSnapshot(
				Long.parseLong(v.get(0).toString()),
				PlaybackState.valueOf(v.get(1).toString()),
				Long.parseLong(v.get(2).toString()),
				Long.parseLong(v.get(3).toString()),
				Long.parseLong(v.get(4).toString()));
	}

	/**
	 * 그룹이 트는 곡을 바꾼다.
	 * @return 바뀐 뒤의 순번
	 */
	public long savePlayback(String captainEmail, long musicId, PlaybackState state,
			long positionMs, long updatedAt) {
		Long snapshotSeq = redis.execute(SAVE_PLAYBACK_SCRIPT, List.of(PLAYBACK_PREFIX + captainEmail),
				Long.toString(musicId), state.name(), Long.toString(positionMs), Long.toString(updatedAt));
		return snapshotSeq == null ? 0L : snapshotSeq;
	}
}
