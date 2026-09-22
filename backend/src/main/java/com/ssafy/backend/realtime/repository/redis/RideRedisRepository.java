package com.ssafy.backend.realtime.repository.redis;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Repository;

import com.ssafy.backend.realtime.dto.ride.PlaybackState;
import com.ssafy.backend.realtime.dto.ride.RidePanelTab;

import lombok.RequiredArgsConstructor;

/**
 * 따라가기 Redis 키는 여기서만 만든다.
 * ride:captain:{따라가는 사람}(Hash) · ride:riders:{인솔자}(Set) · ride:playback:{인솔자}(Hash)
 * · ride:panel:{인솔자}(Hash).
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
	// 지도 인덱스 키. 내릴 때 여기에 다시 넣어야 남들 화면에 보인다.
	// PresenceRedisRepository 와 같은 문자열이다 — 같은 인덱스를 가리킨다.
	private static final String LISTENERS_PREFIX = "listeners:";
	private static final String LAYER_LISTENERS_PREFIX = "layer-listeners:";
	private static final String ACTIVE_CELL_PREFIX = "active-song:cell:";
	private static final String ACTIVE_CELLS_PREFIX = "active-song:cells:";
	private static final String USERCOUNT_PREFIX = "cell:usercount:";

	private static final String CAPTAIN_PREFIX = "ride:captain:"; // 내가 따라가는 사람
	private static final String RIDERS_PREFIX = "ride:riders:"; // 나를 따라오는 사람들
	private static final String PLAYBACK_PREFIX = "ride:playback:"; // 그룹이 지금 트는 곡
	private static final String PANEL_PREFIX = "ride:panel:"; // 인솔자가 열어 둔 곡 상세

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
	private final DefaultRedisScript<List> rideDismountScript;
	private final DefaultRedisScript<List> rideDisbandScript;
	private final DefaultRedisScript<List> rideRiderLeaveScript;

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

	/**
	 * 하차 결과. 성공이면 내린 자리와 남은 인원이 같이 온다.
	 *
	 * @param remainingMates 이 사람을 뺀 뒤의 선단. 만남에서 뺄 명단을 만들 때 쓴다
	 * @param residents 내린 사람이 지도에 다시 들어가기 전, 그 곡에 있던 사람들. 만남 계산에 쓴다
	 */
	public record DismountResult(DismountStatus status, long musicId, int layer,
			int cellX, int cellY, List<String> remainingMates, List<String> residents) {

		/** 남은 인원. 명단의 크기가 곧 인원이다. */
		public int remainingRiders() {
			return remainingMates.size();
		}

		/** 실패 결과를 만든다. */
		private static DismountResult of(DismountStatus status) {
			return new DismountResult(status, 0, 0, 0, 0, List.of(), List.of());
		}
	}

	/** 하차가 거부된 이유. */
	public enum DismountStatus {
		/** 성공. */
		OK,
		/** 따라가는 중이 아니다. 이미 내려졌을 수도 있다. */
		NOT_RIDING,
		/** 접속 정보가 없다. 소켓이 끊긴 뒤 들어온 요청이다. */
		NOT_CONNECTED,
		/** 그 사이에 갈아탔거나, 이전 연결에서 만든 탑승이거나, 서 있는 자리가 없다. */
		STALE
	}

	/**
	 * 해체 결과.
	 *
	 * @param riders 따라가던 사람 전원. 끝났다는 알림은 이 전원에게 간다
	 * @param leftRiders 지도에 다시 넣은 사람들. 접속이 이미 끊긴 사람은 빠진다
	 * @param residents 아무도 다시 넣기 전, 그 곡에 있던 사람들. 만남 계산에 쓴다
	 */
	public record DisbandResult(boolean hadRiders, long musicId, int layer, int cellX, int cellY,
			List<String> riders, List<String> leftRiders, List<String> residents) {

		/** 따라오던 사람이 없었던 결과. */
		private static DisbandResult empty() {
			return new DisbandResult(false, 0, 0, 0, 0, List.of(), List.of(), List.of());
		}
	}

	/** 하차 응답을 자리·남은 동료·그 곡에 있던 사람들로 나눈다. */
	private static DismountResult dismounted(List<String> r) {
		int mateCount = Integer.parseInt(r.get(5));
		int residentCount = Integer.parseInt(r.get(6));
		int residentFrom = 7 + mateCount;
		return new DismountResult(DismountStatus.OK,
				Long.parseLong(r.get(1)), Integer.parseInt(r.get(2)),
				Integer.parseInt(r.get(3)), Integer.parseInt(r.get(4)),
				List.copyOf(r.subList(7, residentFrom)),
				List.copyOf(r.subList(residentFrom, residentFrom + residentCount)));
	}

	/** 빈 칸이나 숫자가 아닌 값은 0 으로 본다. */
	private static long numberOrZero(String value) {
		if (value == null || value.isBlank()) {
			return 0L;
		}
		try {
			return Long.parseLong(value);
		} catch (NumberFormatException e) {
			return 0L;
		}
	}

	/**
	 * 따라가던 사람 한 명이 사라졌을 때 그 사람만 뺀다. 선단은 그대로 둔다.
	 *
	 * @param riderEmail 사라진 사람
	 * @param remainingRiders 그 사람을 뺀 뒤 남은 인원
	 */
	public record RiderLeaveResult(String captainEmail, int remainingRiders) {
	}

	/**
	 * 따라가던 사람 한 명을 선단에서 뺀다.
	 *
	 * 지도에 다시 넣지 않는다. 사라진 사람이라 넣으면 유령이 된다.
	 * 스스로 내리는 것(dismount)과 다른 점이 그것이다.
	 *
	 * @param riderEmail 사라진 사람
	 * @return 인솔자와 남은 인원. 따라가는 중이 아니었으면 null
	 */
	@SuppressWarnings("unchecked")
	public RiderLeaveResult riderLeave(String riderEmail) {
		List<String> r = redis.execute(rideRiderLeaveScript,
				List.of(CAPTAIN_PREFIX + riderEmail),
				riderEmail, RIDERS_PREFIX, PRESENCE_USER_PREFIX + riderEmail);

		if (r == null || r.size() < 3 || !"OK".equals(r.get(0))) {
			return null;
		}
		return new RiderLeaveResult(r.get(1), Integer.parseInt(r.get(2)));
	}

	/**
	 * 인솔자 한 명의 선단을 흩는다. 그를 따라가던 사람 전원이 인솔자의 마지막 곡에 남는다.
	 *
	 * 한 명씩 나눠 하면 그 사이에 따라가지도 않고 지도에도 없는 사람이 생긴다.
	 * 스무 명이면 그 구간이 스무 배 길다. 그래서 한 스크립트에서 끝낸다.
	 *
	 * @param captainEmail 사라진 인솔자
	 * @return 내린 사람들과 그 곡에 원래 있던 사람들. 따라오던 사람이 없었으면 빈 결과
	 */
	@SuppressWarnings("unchecked")
	public DisbandResult disband(String captainEmail) {
		List<String> r = redis.execute(rideDisbandScript,
				List.of(RIDERS_PREFIX + captainEmail,
						PLAYBACK_PREFIX + captainEmail,
						PANEL_PREFIX + captainEmail),
				captainEmail, PRESENCE_USER_PREFIX, CAPTAIN_PREFIX,
				LISTENERS_PREFIX, LAYER_LISTENERS_PREFIX,
				ACTIVE_CELL_PREFIX, ACTIVE_CELLS_PREFIX, USERCOUNT_PREFIX);

		if (r == null || r.isEmpty() || !"OK".equals(r.get(0))) {
			return DisbandResult.empty();
		}
		// 여섯~여덟 번째 칸이 각각 몇 명인지를 말해 준다.
		// 그 뒤로 따라가던 전원, 지도로 돌아간 사람들, 원래 있던 사람들 순이다.
		int riderCount = Integer.parseInt(r.get(5));
		int leftCount = Integer.parseInt(r.get(6));
		int residentCount = Integer.parseInt(r.get(7));
		int leftFrom = 8 + riderCount;
		int residentFrom = leftFrom + leftCount;
		// 아무도 서 있는 자리를 갖고 있지 않으면 자리 칸이 빈 문자열로 온다. 0 으로 받아
		// 부르는 쪽이 "돌아갈 자리를 못 찾았다"로 판단하게 한다.
		return new DisbandResult(true,
				numberOrZero(r.get(1)), (int) numberOrZero(r.get(2)),
				(int) numberOrZero(r.get(3)), (int) numberOrZero(r.get(4)),
				List.copyOf(r.subList(8, leftFrom)),
				List.copyOf(r.subList(leftFrom, residentFrom)),
				List.copyOf(r.subList(residentFrom, residentFrom + residentCount)));
	}

	/**
	 * 따라가기를 끝내고 지도에 다시 넣는다.
	 *
	 * 등록 지우기와 지도 복귀를 한 번에 한다. 나누면 그 사이에
	 * "따라가지도 않고 지도에도 없는" 순간이 생긴다.
	 *
	 * @param riderEmail 내리는 사람
	 * @param captainEmail 따라가던 사람. 실제와 다르면 거부한다
	 * @return 성공이면 돌아간 자리·남은 인원·그 곡에 있던 사람들, 아니면 거부 사유
	 */
	@SuppressWarnings("unchecked")
	public DismountResult dismount(String riderEmail, String captainEmail) {
		List<String> r = redis.execute(rideDismountScript,
				List.of(PRESENCE_USER_PREFIX + riderEmail,
						CAPTAIN_PREFIX + riderEmail,
						RIDERS_PREFIX + captainEmail,
						PLAYBACK_PREFIX + captainEmail,
						PANEL_PREFIX + captainEmail),
				riderEmail, captainEmail,
				LISTENERS_PREFIX, LAYER_LISTENERS_PREFIX,
				ACTIVE_CELL_PREFIX, ACTIVE_CELLS_PREFIX, USERCOUNT_PREFIX);

		// 빈 응답은 스크립트가 못 돈 것이다. 아무것도 안 지워졌으니 거부로 본다.
		if (r == null || r.isEmpty()) {
			return DismountResult.of(DismountStatus.STALE);
		}
		return switch (r.get(0)) {
			// 다섯 번째 칸까지가 자리, 여섯·일곱 번째가 각각 몇 명인지,
			// 그 뒤로 남은 동료들, 그 뒤로 그 곡에 있던 사람들.
			case "OK" -> dismounted(r);
			case "NOT_RIDING" -> DismountResult.of(DismountStatus.NOT_RIDING);
			case "NOT_CONNECTED" -> DismountResult.of(DismountStatus.NOT_CONNECTED);
			// 모르는 값이나 빈 응답은 스크립트가 못 돈 것이다. 아무것도 안 지워졌으니 거부로 본다.
			default -> DismountResult.of(DismountStatus.STALE);
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

	/**
	 * 여러 사람을 한 번에 물어 각자를 따라오는 사람들을 읽는다.
	 *
	 * 한 명씩 물으면 사람 수만큼 왕복이 생긴다. 화면 변화 알림은 수신자가 여럿이라
	 * 그 왕복이 그대로 지연이 된다. 그래서 한 번에 묶어 보낸다.
	 *
	 * @param captainEmails 물어볼 사람들
	 * @return 따라오는 사람이 있는 사람만 담긴 결과. 없으면 아예 빠진다
	 */
	public Map<String, Set<String>> ridersOf(Collection<String> captainEmails) {
		if (captainEmails == null || captainEmails.isEmpty()) {
			return Map.of();
		}
		List<String> targets = List.copyOf(new LinkedHashSet<>(captainEmails));
		byte[][] keys = targets.stream()
				.map(email -> redis.getStringSerializer().serialize(RIDERS_PREFIX + email))
				.toArray(byte[][]::new);
		List<Object> results = redis.executePipelined((RedisCallback<Object>) connection -> {
			for (byte[] key : keys) {
				connection.setCommands().sMembers(key);
			}
			return null;
		});

		Map<String, Set<String>> ridersByCaptain = new LinkedHashMap<>();
		for (int i = 0; i < targets.size(); i++) {
			Set<String> riders = toStringSet(i < results.size() ? results.get(i) : null);
			if (!riders.isEmpty()) {
				ridersByCaptain.put(targets.get(i), riders);
			}
		}
		return ridersByCaptain;
	}

	/**
	 * 사람 목록을 넘기면, 그 사람들을 따라오는 인원이 각각 몇 명인지 돌려준다.
	 *
	 * 누가 인솔자인지 미리 알 수 없어서 화면에 보이는 사람을 전부 넘긴다.
	 * ride:riders 가 비어 있으면 인솔자가 아닌 것이고, 그 사람은 결과에서 빠진다.
	 *
	 * 뷰포트에 20명이 있다고 할 때, 한 명씩 읽으면 Redis 를 스무 번 다녀와야 해서 한 번에 묶어 보낸다.
	 * 누가 따라오는지는 필요 없고 몇 명인지만 필요해서 SCARD 로 센다.
	 *
	 * @param captainEmails 인원 수를 알고 싶은 사람들
	 * @return 따라오는 사람이 있는 사람만 담긴다. 없는 사람은 아예 빠진다
	 */
	public Map<String, Integer> riderCountsOf(Collection<String> captainEmails) {
		if (captainEmails == null || captainEmails.isEmpty()) {
			return Map.of();
		}
		List<String> targets = List.copyOf(new LinkedHashSet<>(captainEmails));
		byte[][] keys = targets.stream()
				.map(email -> redis.getStringSerializer().serialize(RIDERS_PREFIX + email))
				.toArray(byte[][]::new);
		List<Object> results = redis.executePipelined((RedisCallback<Object>) connection -> {
			for (byte[] key : keys) {
				connection.setCommands().sCard(key);
			}
			return null;
		});

		Map<String, Integer> countByCaptain = new LinkedHashMap<>();
		for (int i = 0; i < targets.size(); i++) {
			int count = toCount(i < results.size() ? results.get(i) : null);
			if (count > 0) {
				countByCaptain.put(targets.get(i), count);
			}
		}
		return countByCaptain;
	}

	/** 묶어 읽은 결과 한 칸을 인원 수로 바꾼다. */
	private static int toCount(Object value) {
		return value instanceof Number n ? n.intValue() : 0;
	}

	/** 묶어 읽은 결과 한 칸을 사람 목록으로 바꾼다. */
	private static Set<String> toStringSet(Object value) {
		if (!(value instanceof Set<?> set)) {
			return Set.of();
		}
		Set<String> result = new LinkedHashSet<>();
		for (Object item : set) {
			if (item != null) {
				result.add(item.toString());
			}
		}
		return result;
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

	/** 인솔자가 열어 둔 곡 상세. 키가 없으면 닫혀 있다는 뜻이다. */
	public record PanelSnapshot(long musicId, RidePanelTab tab) {
	}

	/** 인솔자가 연 곡 상세를 저장한다. 나중에 탄 사람에게 같은 화면을 보여줄 때 쓴다. */
	public void savePanel(String captainEmail, long musicId, RidePanelTab tab) {
		redis.opsForHash().putAll(PANEL_PREFIX + captainEmail,
				Map.of("musicId", Long.toString(musicId), "tab", tab.value()));
	}

	/** 인솔자가 열어 둔 곡 상세를 읽는다. 닫혀 있으면 null. */
	public PanelSnapshot findPanel(String captainEmail) {
		List<Object> v = redis.opsForHash().multiGet(PANEL_PREFIX + captainEmail,
				List.of("musicId", "tab"));
		if (v == null || v.get(0) == null || v.get(1) == null) {
			return null;
		}
		RidePanelTab tab = RidePanelTab.from(v.get(1).toString());
		if (tab == null) {
			return null;
		}
		return new PanelSnapshot(Long.parseLong(v.get(0).toString()), tab);
	}

	/** 열어 둔 곡 상세를 지운다. 닫힌 상태는 키가 없는 것으로 나타낸다. */
	public void deletePanel(String captainEmail) {
		redis.delete(PANEL_PREFIX + captainEmail);
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
