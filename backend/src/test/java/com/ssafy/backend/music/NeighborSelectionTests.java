package com.ssafy.backend.music;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.ssafy.backend.music.retrieval.NeighborSelection;
import com.ssafy.backend.music.retrieval.ServingRules;
import com.ssafy.backend.music.retrieval.TrackCandidate;

/**
 * 선정 규칙 유닛 테스트 (quickstart B).
 *
 * <p>순수 함수라 저장소도 mock 도 필요 없다 — 합성 후보만으로 전부 검증된다.
 * 임계값은 운영 {@code application.yml} 과 같은 값을 쓴다(실제 동작과 어긋난 값으로 통과하면 의미가 없다).
 */
class NeighborSelectionTests {

	private static final ServingRules RULES =
			new ServingRules("v2.1-pca16", 1.6624, 3, 4.912, 30, 1200, 10.7);

	private static final float[] ORIGIN = new float[16];

	private static TrackCandidate c(long id, String title, String artist, Integer duration, double dist) {
		return new TrackCandidate(id, "mbid-" + id, title, artist, duration, ORIGIN, dist);
	}

	/** 기준 곡. 거리 0. */
	private static TrackCandidate query() {
		return c(1, "Query", "QueryArtist", 200, 0.0);
	}

	@Test
	@DisplayName("B1 후보에 기준 곡 자신이 있으면 결과에서 빠진다")
	void b1_excludesSelf() {
		List<TrackCandidate> out = NeighborSelection.select(
				List.of(query(), c(2, "A", "AA", 200, 3.0)), query(), RULES, 10);

		assertThat(out).extracting(TrackCandidate::id).containsExactly(2L);
	}

	@Test
	@DisplayName("B2 거리가 중복 임계값 미만이면 같은 녹음으로 보고 뺀다")
	void b2_excludesSameRecordingByDistance() {
		List<TrackCandidate> out = NeighborSelection.select(
				List.of(c(2, "A", "AA", 200, 1.0), c(3, "B", "BB", 200, 3.0)), query(), RULES, 10);

		assertThat(out).extracting(TrackCandidate::id).containsExactly(3L);
	}

	@Test
	@DisplayName("B3 기준 곡과 제목·아티스트가 같으면 뺀다")
	void b3_excludesSameKeyAsQuery() {
		List<TrackCandidate> out = NeighborSelection.select(
				List.of(c(2, "query", "  QUERYARTIST ", 200, 3.0), c(3, "B", "BB", 200, 3.5)),
				query(), RULES, 10);

		assertThat(out).extracting(TrackCandidate::id).containsExactly(3L);
	}

	@Test
	@DisplayName("B4 이미 담은 이웃과 같은 제목·아티스트면 뺀다")
	void b4_dedupesAmongNeighbors() {
		List<TrackCandidate> out = NeighborSelection.select(
				List.of(c(2, "Same", "SS", 200, 3.0), c(3, "same", " ss ", 200, 3.1), c(4, "B", "BB", 200, 3.2)),
				query(), RULES, 10);

		assertThat(out).extracting(TrackCandidate::id).containsExactly(2L, 4L);
	}

	@Test
	@DisplayName("B5 같은 아티스트는 상한까지만 담고 나머지 자리는 다음 후보로 채운다")
	void b5_artistCap() {
		List<TrackCandidate> in = new ArrayList<>();
		for (int i = 0; i < 5; i++) {
			in.add(c(10 + i, "T" + i, "Same Artist", 200, 3.0 + i * 0.01));
		}
		in.add(c(99, "Other", "Other Artist", 200, 9.0));

		List<TrackCandidate> out = NeighborSelection.select(in, query(), RULES, 10);

		assertThat(out).extracting(TrackCandidate::id).containsExactly(10L, 11L, 12L, 99L);
	}

	@Test
	@DisplayName("B6 대소문자·공백만 다른 아티스트명도 같은 아티스트로 세어 상한이 걸린다")
	void b6_artistCapIgnoresCaseAndSpace() {
		List<TrackCandidate> out = NeighborSelection.select(
				List.of(c(2, "T1", "IU", 200, 3.0), c(3, "T2", "iu", 200, 3.1),
						c(4, "T3", " Iu ", 200, 3.2), c(5, "T4", "IU", 200, 3.3)),
				query(), RULES, 10);

		assertThat(out).extracting(TrackCandidate::id).containsExactly(2L, 3L, 4L);
	}

	@Test
	@DisplayName("B6-1 아티스트가 비어 있는 곡은 상한에서 세지 않는다")
	void b6_1_emptyArtistNotCapped() {
		List<TrackCandidate> in = new ArrayList<>();
		for (int i = 0; i < 5; i++) {
			in.add(c(20 + i, "T" + i, "   ", 200, 3.0 + i * 0.01));
		}

		List<TrackCandidate> out = NeighborSelection.select(in, query(), RULES, 10);

		assertThat(out).hasSize(5);
	}

	@Test
	@DisplayName("B7 길이 범위 밖인 곡은 뺀다")
	void b7_lengthRange() {
		List<TrackCandidate> out = NeighborSelection.select(
				List.of(c(2, "Short", "AA", 29, 3.0), c(3, "Long", "BB", 1201, 3.1), c(4, "Ok", "CC", 30, 3.2)),
				query(), RULES, 10);

		assertThat(out).extracting(TrackCandidate::id).containsExactly(4L);
	}

	@Test
	@DisplayName("B8 길이를 모르는 곡은 길이 규칙을 적용하지 않고 통과시킨다")
	void b8_nullDurationPasses() {
		List<TrackCandidate> out = NeighborSelection.select(
				List.of(c(2, "A", "AA", null, 3.0)), query(), RULES, 10);

		assertThat(out).extracting(TrackCandidate::id).containsExactly(2L);
	}

	@Test
	@DisplayName("B9 제목이 빈 곡 둘은 서로 같은 녹음으로 보지 않는다")
	void b9_emptyTitleKeysAreNotEqual() {
		List<TrackCandidate> out = NeighborSelection.select(
				List.of(c(2, "", "AA", 200, 3.0), c(3, "", "BB", 200, 3.1)), query(), RULES, 10);

		assertThat(out).extracting(TrackCandidate::id).containsExactly(2L, 3L);
	}

	@Test
	@DisplayName("B10 규칙을 통과한 곡이 요청보다 적으면 있는 만큼만 준다")
	void b10_fewerThanLimit() {
		List<TrackCandidate> out = NeighborSelection.select(
				List.of(c(2, "A", "AA", 200, 3.0), c(3, "B", "BB", 200, 3.1), c(4, "C", "CC", 200, 3.2)),
				query(), RULES, 10);

		assertThat(out).hasSize(3);
	}

	@Test
	@DisplayName("B11 규칙을 통과한 곡이 없으면 빈 목록이고 오류가 아니다")
	void b11_emptyIsNotError() {
		List<TrackCandidate> out = NeighborSelection.select(
				List.of(c(2, "A", "AA", 10, 3.0)), query(), RULES, 10);

		assertThat(out).isEmpty();
	}

	@Test
	@DisplayName("B12 거리가 같으면 id 오름차순으로 순서가 정해진다")
	void b12_tieBreakById() {
		List<TrackCandidate> out = NeighborSelection.select(
				List.of(c(9, "A", "AA", 200, 3.0), c(4, "B", "BB", 200, 3.0), c(7, "C", "CC", 200, 3.0)),
				query(), RULES, 10);

		assertThat(out).extracting(TrackCandidate::id).containsExactly(4L, 7L, 9L);
	}

	@Test
	@DisplayName("B13 후보 입력 순서가 흔들려도 결과 목록과 순서가 같다")
	void b13_stableAgainstApproximateOrder() {
		List<TrackCandidate> in = new ArrayList<>(List.of(
				c(2, "A", "AA", 200, 3.0), c(3, "B", "BB", 200, 3.1), c(4, "C", "CC", 200, 3.2)));
		List<TrackCandidate> first = NeighborSelection.select(in, query(), RULES, 10);

		Collections.reverse(in);
		List<TrackCandidate> second = NeighborSelection.select(in, query(), RULES, 10);

		assertThat(second).extracting(TrackCandidate::id)
				.containsExactlyElementsOf(first.stream().map(TrackCandidate::id).toList());
	}

	@Test
	@DisplayName("B14 기준점이 곡이 아니면 자기 제외·기준점 키 판정을 적용하지 않는다")
	void b14_coordinateCenterSkipsSelfRules() {
		List<TrackCandidate> out = NeighborSelection.select(
				List.of(c(1, "Query", "QueryArtist", 200, 3.0), c(2, "B", "BB", 200, 3.1)),
				null, RULES, 10);

		assertThat(out).extracting(TrackCandidate::id).containsExactly(1L, 2L);
	}
}
