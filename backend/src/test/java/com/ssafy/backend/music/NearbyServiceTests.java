package com.ssafy.backend.music;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.MusicErrorCode;
import com.ssafy.backend.music.detail.MusicDetailReader;
import com.ssafy.backend.music.dto.Location;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.music.dto.MusicSummary;
import com.ssafy.backend.music.dto.NearbyResponse;
import com.ssafy.backend.music.retrieval.NearestTrackReader;
import com.ssafy.backend.music.retrieval.ServingRules;
import com.ssafy.backend.music.retrieval.TrackCandidate;
import com.ssafy.backend.music.service.NearbyService;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

/** 주변 탐색 서비스 유닛 테스트 (quickstart C). 조회는 전부 mock 이라 저장소 없이 돈다. */
class NearbyServiceTests {

	private static final ServingRules RULES =
			new ServingRules("v2.1-pca16", 1.6624, 3, 4.912, 30, 1200, 10.7);

	private MusicDetailReader detailReader;
	private NearestTrackReader nearestReader;
	private NearbyService service;

	@BeforeEach
	void setUp() {
		detailReader = mock(MusicDetailReader.class);
		nearestReader = mock(NearestTrackReader.class);
		service = new NearbyService(Optional.of(nearestReader), detailReader, RULES, new SimpleMeterRegistry());
	}

	private static Location loc() {
		return new Location(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
	}

	private static MusicDetail detail(long id) {
		return new MusicDetail(id, "mbid-" + id, "Query", "QueryArtist", 120.0, 200,
				"Album", List.of(), "https://y/x", null, loc(), 0, 0);
	}

	private static TrackCandidate cand(long id, double dist) {
		return new TrackCandidate(id, "mbid-" + id, "T" + id, "Artist" + id, 200, new float[16], dist);
	}

	private static MusicSummary summary(long id) {
		return new MusicSummary(id, "T" + id, "Artist" + id, null, List.of(), "https://y/" + id, null, loc());
	}

	private void given(long centerId, List<TrackCandidate> candidates) {
		when(detailReader.findDetail(centerId)).thenReturn(Optional.of(detail(centerId)));
		when(nearestReader.findNearest(org.mockito.ArgumentMatchers.any(), eq(200)))
				.thenReturn(candidates);
		when(detailReader.findSummariesByMbids(anyList()))
				.thenAnswer(inv -> {
					List<String> mbids = inv.getArgument(0);
					return mbids.stream()
							.map(m -> summary(Long.parseLong(m.substring("mbid-".length()))))
							.toList();
				});
	}

	@Test
	@DisplayName("C1 곡 기준 정상 — 기준점과 이웃을 함께 담고 거리 오름차순이다")
	void c1_happyPath() {
		given(1, List.of(cand(2, 3.0), cand(3, 3.5)));

		NearbyResponse res = service.findNearby(1);

		assertThat(res.center().id()).isEqualTo(1L);
		assertThat(res.center().location()).isNotNull();
		assertThat(res.neighbors()).extracting(n -> n.music().id()).containsExactly(2L, 3L);
		assertThat(res.neighbors()).extracting(n -> n.distance()).isSorted();
	}

	@Test
	@DisplayName("C3 마지막 이웃이 멀면 유사도 낮음이 붙고 결과는 그대로 준다")
	void c3_lowSimilarity() {
		given(1, List.of(cand(2, 3.0), cand(3, 5.0)));

		NearbyResponse res = service.findNearby(1);

		assertThat(res.lowSimilarity()).isTrue();
		assertThat(res.neighbors()).hasSize(2);
	}

	@Test
	@DisplayName("C4 이웃이 0곡이면 빈 배열이고 유사도 낮음이다")
	void c4_emptyNeighbors() {
		given(1, List.of());

		NearbyResponse res = service.findNearby(1);

		assertThat(res.neighbors()).isEmpty();
		assertThat(res.lowSimilarity()).isTrue();
	}

	@Test
	@DisplayName("C5 없는 곡을 기준점으로 주면 MUSIC_NOT_FOUND")
	void c5_missingCenter() {
		when(detailReader.findDetail(999)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.findNearby(999))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(MusicErrorCode.MUSIC_NOT_FOUND);
	}

	@Test
	@DisplayName("C6 좌표 조회 어댑터가 없으면 예외로 드러낸다 — 부분 결과를 성공으로 내지 않는다")
	void c6_readerAbsent() {
		NearbyService bare = new NearbyService(Optional.empty(), detailReader, RULES, new SimpleMeterRegistry());
		when(detailReader.findDetail(1)).thenReturn(Optional.of(detail(1)));

		assertThatThrownBy(() -> bare.findNearby(1))
				.isInstanceOf(UnsupportedOperationException.class);
	}

	@Test
	@DisplayName("C8 후보를 200개 요청하고 선정 조건을 조회에 넘기지 않는다")
	void c8_candidateCount() {
		given(1, List.of(cand(2, 3.0)));

		service.findNearby(1);

		ArgumentCaptor<Integer> limit = ArgumentCaptor.forClass(Integer.class);
		verify(nearestReader).findNearest(org.mockito.ArgumentMatchers.any(), limit.capture());
		assertThat(limit.getValue()).isEqualTo(200);
	}

	@Test
	@DisplayName("C7 조회 전용이다 — 읽기 port 만 쓰고 그 밖의 상호작용이 없다")
	void c7_readOnly() {
		given(1, List.of(cand(2, 3.0)));

		service.findNearby(1);

		verify(detailReader).findDetail(1L);
		verify(detailReader).findSummariesByMbids(anyList());
		verify(nearestReader).findNearest(org.mockito.ArgumentMatchers.any(), eq(200));
		org.mockito.Mockito.verifyNoMoreInteractions(detailReader, nearestReader);
	}

	@Test
	@DisplayName("T038 선정된 곡의 상세를 못 찾으면 부분 목록을 성공으로 내지 않는다")
	void t038_missingSummaryFails() {
		when(detailReader.findDetail(1)).thenReturn(Optional.of(detail(1)));
		when(nearestReader.findNearest(org.mockito.ArgumentMatchers.any(), eq(200)))
				.thenReturn(List.of(cand(2, 3.0), cand(3, 3.5)));
		when(detailReader.findSummariesByMbids(anyList())).thenReturn(List.of(summary(2)));

		assertThatThrownBy(() -> service.findNearby(1))
				.isInstanceOf(IllegalStateException.class);
	}

	@Test
	@DisplayName("US2 이웃을 다시 기준점으로 요청해도 이전 요청 이력에 의존하지 않는다")
	void us2_statelessChaining() {
		given(1, List.of(cand(2, 3.0)));
		given(2, List.of(cand(3, 3.0)));

		NearbyResponse first = service.findNearby(1);
		NearbyResponse second = service.findNearby(2);

		assertThat(first.center().id()).isEqualTo(1L);
		assertThat(second.center().id()).isEqualTo(2L);
		assertThat(second.neighbors()).extracting(n -> n.music().id()).containsExactly(3L);
	}

	@Test
	@DisplayName("US2 돌아왔을 때 처음과 같은 목록·순서를 준다 — 경로와 무관하다")
	void us2_pathIndependentDeterminism() {
		given(1, List.of(cand(2, 3.0), cand(3, 3.5)));
		given(2, List.of(cand(4, 3.0)));

		NearbyResponse first = service.findNearby(1);
		service.findNearby(2);
		NearbyResponse again = service.findNearby(1);

		assertThat(again.neighbors()).extracting(n -> n.music().id())
				.containsExactlyElementsOf(first.neighbors().stream().map(n -> n.music().id()).toList());
	}
}
