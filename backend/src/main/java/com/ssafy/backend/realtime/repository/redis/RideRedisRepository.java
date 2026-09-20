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

	// presence 쪽 키는 PresenceRedisRepository 와 같은 문자열이다. 접속 번호와 현재 곡을
	// 따라가기 시작 검사에서 같이 봐야 해서, 두 저장소를 오가지 않고 한 스크립트에 넘긴다.
	private static final String PRESENCE_USER_PREFIX = "presence:user:";

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
	private final DefaultRedisScript<List> rideMountScript;

	/** 따라가기 시작 결과. 거부면 musicId·layer 는 의미 없다. */
	public record MountResult(MountStatus status, long musicId, int layer) {
	}

	/** 따라가기 시작이 거부된 이유. */
	public enum MountStatus {
		/** 성공. */
		OK,
		/** 지금 소켓에서 온 요청이 아니다. */
		STALE,
		/** 이미 누군가를 따라가는 중이다. */
		ALREADY_RIDING,
		/** 줄줄이 따라가기다. 나를 따라오는 사람이 있거나, 대상이 남을 따라가는 중이다. */
		CHAIN,
		/** 대상이 곡 위에 없다. */
		CAPTAIN_INACTIVE,
		/** 자리가 다 찼다. */
		FULL
	}

	/** 내가 따라가는 사람과 그때의 접속 번호. */
	public record Ride(String captainEmail, long epoch) {
	}

	/**
	 * 그룹이 지금 트는 곡.
	 * positionMs 는 updatedAt 당시의 재생 위치. 지금 위치는 읽는 쪽에서 더해서 구한다.
	 * snapshotSeq 는 재생 정보가 바뀔 때마다 1씩 오르는 번호. 어느 쪽이 최신인지 가릴 때 쓴다.
	 * 접속 번호(epoch)와는 상관없다.
	 */
	public record PlaybackSnapshot(long musicId, PlaybackState state, long positionMs, long updatedAt, long snapshotSeq) {

		/**
		 * 지금 재생 위치.
		 * 틀고 있으면 저장된 위치에 그 뒤 흐른 시간을 더하고, 멈춰 있으면 저장된 위치 그대로다.
		 * 멈춰 있는데 더하면 가만히 있어도 위치가 흘러간다.
		 */
		public long positionAt(long nowMs) {
			if (state != PlaybackState.PLAYING) {
				return positionMs;
			}
			return positionMs + Math.max(0, nowMs - updatedAt);
		}
	}

	/**
	 * 따라가기를 시작한다. 자격 확인과 등록이 한 번에 끝난다.
	 *
	 * @param maxRiders 정원
	 * @return 성공이면 대상이 서 있는 곡과 레이어, 아니면 거부 사유
	 */
	@SuppressWarnings("unchecked")
	public MountResult mount(String riderEmail, String captainEmail, long epoch, int maxRiders) {
		// 1. 검사에 필요한 키 여섯 개와 값 네 개를 넘겨 스크립트를 돌린다.
		//    키 순서는 ride-mount.lua 의 KEYS 주석과 같아야 한다.
		List<String> r = redis.execute(rideMountScript,
				List.of(PRESENCE_USER_PREFIX + riderEmail, PRESENCE_USER_PREFIX + captainEmail,
						CAPTAIN_PREFIX + riderEmail, RIDERS_PREFIX + riderEmail,
						CAPTAIN_PREFIX + captainEmail, RIDERS_PREFIX + captainEmail),
				riderEmail, captainEmail, Long.toString(epoch), Integer.toString(maxRiders));

		// 2. 빈 응답은 스크립트가 못 돈 것이다. 등록도 안 됐으니 STALE 로 본다.
		if (r == null || r.isEmpty()) {
			return new MountResult(MountStatus.STALE, 0, 0);
		}

		// 3. 첫 칸이 결과다. 성공이면 뒤에 대상의 곡과 레이어가 붙어 온다.
		return switch (r.get(0)) {
			case "OK" -> new MountResult(MountStatus.OK,
					Long.parseLong(r.get(1)), Integer.parseInt(r.get(2)));
			case "ALREADY" -> new MountResult(MountStatus.ALREADY_RIDING, 0, 0);
			// 양쪽 방향 모두 줄줄이 따라가기다. 사유는 로그로만 갈라 본다.
			case "CHAIN_HAS_RIDERS", "CHAIN_TARGET_RIDING" -> new MountResult(MountStatus.CHAIN, 0, 0);
			case "CAPTAIN_INACTIVE" -> new MountResult(MountStatus.CAPTAIN_INACTIVE, 0, 0);
			case "FULL" -> new MountResult(MountStatus.FULL, 0, 0);
			default -> new MountResult(MountStatus.STALE, 0, 0);
		};
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
