package com.ssafy.backend.music.retrieval;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 이웃 선정 규칙 (005 FR-006·FR-018~FR-021, data-model §4-2).
 *
 * <p><b>이 클래스가 규칙의 유일한 구현이다.</b> 주변 탐색(005)과 곡 상세(003)의 이웃 목록이 모두 여기를
 * 지나간다 — 같은 곡을 기준으로 하면 두 진입점의 목록이 같아야 한다(FR-023, SC-006). 규칙을 복제하거나
 * 한쪽에서만 완화하면 사용자에게는 버그로 보인다.
 *
 * <p>저장소를 모르는 순수 함수다. 합성 후보만으로 전부 검증된다.
 *
 * <p><b>왜 후보를 넉넉히 받는가</b>: 조회에 필터를 넣을 수 없기 때문이다. pgvector 0.7.0 은 근사 색인이
 * {@code ef_search} 개를 먼저 뽑고 <b>그 뒤에</b> {@code WHERE} 를 적용해서, 조건을 질의에 넣으면 요청한
 * {@code limit} 보다 적게 돌아온다. 그래서 넉넉히 뽑아 여기서 거른다.
 */
public final class NeighborSelection {

	private NeighborSelection() {
	}

	/**
	 * 후보에 선정 규칙을 적용해 상위 {@code limit} 곡을 고른다.
	 *
	 * <p>거리 오름차순으로 훑으며 판정하고, {@code limit} 이 차면 멈춘다. 마지막에 {@code (거리, id)} 로
	 * 안정 정렬한다 — 근사 조회라 동률·경계에서 순서가 흔들리는데, 정렬이 없으면 같은 요청이 호출마다
	 * 다른 순서를 낸다(FR-008).
	 *
	 * @param candidates 후보. 거리 오름차순이지만 <b>근사라 순서가 흔들릴 수 있다</b>
	 * @param queryTrack 기준점이 곡일 때 그 곡. <b>좌표 기준이면 {@code null}</b> 이고, 이때는 자기 제외와
	 *                   기준점 키 판정이 적용되지 않는다
	 * @param rules      좌표계 버전에 귀속된 임계값. <b>여기서 상수로 박지 않는다</b>(FR-022)
	 * @param limit      반환할 최대 곡 수
	 * @return 규칙을 통과한 최대 {@code limit} 곡. 통과한 곡이 없으면 빈 목록이다
	 */
	public static List<TrackCandidate> select(
			List<TrackCandidate> candidates,
			TrackCandidate queryTrack,
			ServingRules rules,
			int limit) {

		String queryKey = queryTrack == null
				? null
				: SameRecording.key(queryTrack.title(), queryTrack.artist());

		List<TrackCandidate> kept = new ArrayList<>(limit);
		Set<String> keptKeys = new HashSet<>();
		Map<String, Integer> artistCount = new HashMap<>();

		for (TrackCandidate c : candidates) {
			if (queryTrack != null && c.id() == queryTrack.id()) {
				continue;                                   // 1. 자기 자신 (FR-006)
			}
			if (c.dist() < rules.tauDup()) {
				continue;                                   // 2. 기준점과 같은 녹음 (FR-018 a)
			}
			if (!rules.lengthAllowed(c.duration())) {
				continue;                                   // 6. 길이 범위 밖 (FR-020)
			}

			String key = SameRecording.key(c.title(), c.artist());
			if (SameRecording.sameKey(key, queryKey)) {
				continue;                                   // 3. 기준점과 같은 키 (FR-018 c)
			}
			if (key != null && !keptKeys.add(key)) {
				continue;                                   // 4. 이미 담은 이웃과 같은 키 (FR-018 b)
			}

			// 5. 아티스트 편중 (FR-019). 아티스트가 비어 있으면 세지 않는다 — 서로 무관한 곡 14,862건이
			//    한 덩어리로 묶여 자리를 나눠 갖게 된다(2026-09-13 clarify). 빈 키를 null 로 두는 것과 같은 이유다.
			String artist = normalizedArtist(c.artist());
			if (artist != null) {
				int used = artistCount.getOrDefault(artist, 0);
				if (used >= rules.artistCap()) {
					continue;
				}
				artistCount.put(artist, used + 1);
			}

			kept.add(c);
			if (kept.size() == limit) {
				break;
			}
		}
		// 근사 조회라 동률·경계에서 순서가 흔들린다. 정렬이 없으면 같은 요청이 호출마다 다른 순서를 낸다(FR-008).
		kept.sort(Comparator.comparingDouble(TrackCandidate::dist).thenComparingLong(TrackCandidate::id));
		return List.copyOf(kept);
	}

	/**
	 * 상한 카운트용 아티스트 키. 표기 차이(대소문자·앞뒤 공백)를 무시한다 — 원문 비교는 상한을 빠져나간다.
	 *
	 * @return 아티스트가 비어 있으면 {@code null}. 호출자는 null 을 <b>세지 않는다</b>
	 */
	private static String normalizedArtist(String artist) {
		if (artist == null) {
			return null;
		}
		String a = artist.trim().toLowerCase(Locale.ROOT);
		return a.isEmpty() ? null : a;
	}
}
