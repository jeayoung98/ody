package com.ssafy.backend.artwork;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import com.ssafy.backend.artwork.dto.ArtworkPointRow;
import com.ssafy.backend.artwork.dto.ArtworkRoundRow;
import com.ssafy.backend.artwork.dto.ArtworkRow;
import com.ssafy.backend.artwork.evaluation.ArtworkEvaluation;
import com.ssafy.backend.artwork.evaluation.ArtworkEvaluationPort;
import com.ssafy.backend.artwork.mapper.ArtworkMapper;
import com.ssafy.backend.artwork.render.ArtworkRenderer;
import com.ssafy.backend.artwork.service.ArtworkEvaluationService;

/**
 * 채점 결과를 기록하는 규칙 (S15P21A405-563).
 *
 * <p>여기서 지키는 것은 둘이다. <b>실패를 0점으로 저장하지 않는다</b>(spec FR-006), 그리고
 * <b>사라진 작품에 결과를 쓰지 않는다</b>.
 */
class ArtworkEvaluationServiceTests {

	private ArtworkMapper artworkMapper;
	private ArtworkEvaluationPort port;
	private ArtworkEvaluationService service;

	@BeforeEach
	void setUp() {
		artworkMapper = Mockito.mock(ArtworkMapper.class);
		port = Mockito.mock(ArtworkEvaluationPort.class);
		service = new ArtworkEvaluationService(artworkMapper, new ArtworkRenderer(64, 0.02, 0.008f), port);
	}

	@Test
	void writesScore_whenEvaluationSucceeds() {
		givenArtworkWithPoints();
		when(port.evaluate(any(), anyString(), anyList()))
				.thenReturn(Optional.of(new ArtworkEvaluation(87, "귀가 또렷하다", "gpt-4o-mini-2024-07-18")));
		when(artworkMapper.markScored(anyLong(), anyInt(), anyString(), anyString())).thenReturn(1);

		service.evaluate(artwork());

		verify(artworkMapper).markScored(5L, 87, "귀가 또렷하다", "gpt-4o-mini-2024-07-18");
		verify(artworkMapper, never()).markFailed(anyLong(), anyString());
	}

	/** 실패는 FAILED 로만 남는다. markScored 를 0점으로 부르지 않는다. */
	@Test
	void writesFailed_whenPortReturnsEmpty() {
		givenArtworkWithPoints();
		when(port.evaluate(any(), anyString(), anyList())).thenReturn(Optional.empty());

		service.evaluate(artwork());

		verify(artworkMapper).markFailed(eq(5L), anyString());
		verify(artworkMapper, never()).markScored(anyLong(), anyInt(), anyString(), anyString());
	}

	/** 평가 중에 소유자가 작품을 지웠으면 markScored 가 0행이다. 그대로 끝낸다 — 예외를 던지지 않는다. */
	@Test
	void discardsResult_whenArtworkGone() {
		givenArtworkWithPoints();
		when(port.evaluate(any(), anyString(), anyList()))
				.thenReturn(Optional.of(new ArtworkEvaluation(50, "그럭저럭", "gpt-4o-mini")));
		when(artworkMapper.markScored(anyLong(), anyInt(), anyString(), anyString())).thenReturn(0);

		service.evaluate(artwork());

		verify(artworkMapper, never()).markFailed(anyLong(), anyString());
	}

	@Test
	void writesFailed_whenRoundMissing() {
		when(artworkMapper.findRoundById(1L)).thenReturn(null);

		service.evaluate(artwork());

		verify(artworkMapper).markFailed(eq(5L), anyString());
		verify(port, never()).evaluate(any(), anyString(), anyList());
	}

	@Test
	void writesFailed_whenNoPoints() {
		when(artworkMapper.findRoundById(1L)).thenReturn(round());
		when(artworkMapper.findPoints(5L)).thenReturn(List.of());

		service.evaluate(artwork());

		verify(artworkMapper).markFailed(eq(5L), anyString());
		verify(port, never()).evaluate(any(), anyString(), anyList());
	}

	/**
	 * 회차의 기준 그림을 렌더해 점수와 함께 포트에 넘긴다 (few-shot). 기준이 없으면 빈 목록이고 채점은
	 * 그대로 진행한다 — 진단에서 기준 없는 채점은 변별력이 크게 떨어졌지만(plan.md v3~v5) 막지는 않는다.
	 */
	@Test
	void passesRenderedAnchorsToPort() {
		givenArtworkWithPoints();
		ArtworkRow anchorHigh = artwork();
		anchorHigh.setId(901L);
		anchorHigh.setScore(75);
		ArtworkRow anchorLow = artwork();
		anchorLow.setId(902L);
		anchorLow.setScore(5);
		when(artworkMapper.findAnchors(1L)).thenReturn(List.of(anchorHigh, anchorLow));
		when(artworkMapper.findPoints(901L)).thenReturn(List.of(
				new ArtworkPointRow(0, 1L, -0.2, 0.2), new ArtworkPointRow(1, 2L, 0.2, -0.2)));
		when(artworkMapper.findPoints(902L)).thenReturn(List.of(
				new ArtworkPointRow(0, 3L, 0.9, 0.9), new ArtworkPointRow(1, 4L, -0.9, 0.9)));
		when(port.evaluate(any(), anyString(), anyList())).thenReturn(Optional.empty());

		service.evaluate(artwork());

		@SuppressWarnings("unchecked")
		org.mockito.ArgumentCaptor<List<com.ssafy.backend.artwork.evaluation.ArtworkAnchor>> anchors =
				org.mockito.ArgumentCaptor.forClass(List.class);
		verify(port).evaluate(any(), eq("고양이를 얼마나 닮았는지 채점하라."), anchors.capture());
		assertThat(anchors.getValue()).hasSize(2);
		assertThat(anchors.getValue().get(0).score()).isEqualTo(75);
		assertThat(anchors.getValue().get(1).score()).isEqualTo(5);
		assertThat(anchors.getValue().get(0).pngBytes()).startsWith((byte) 0x89, (byte) 'P', (byte) 'N', (byte) 'G');
	}

	/** 포트가 예외를 던져도 밖으로 새지 않는다 — 한 작품의 실패가 배치를 멈추면 안 된다. */
	@Test
	void writesFailed_whenPortThrows() {
		givenArtworkWithPoints();
		when(port.evaluate(any(), anyString(), anyList())).thenThrow(new IllegalStateException("boom"));

		service.evaluate(artwork());

		verify(artworkMapper).markFailed(eq(5L), anyString());
	}

	/** 닫힌 작품은 마지막→첫 곡 선까지 그린 그림으로 채점한다 (S15P21A405-616). */
	@Test
	void rendersClosedShape_whenArtworkClosed() {
		List<ArtworkPointRow> triangle = List.of(
				new ArtworkPointRow(0, 10L, -0.5, 0.5), new ArtworkPointRow(1, 11L, 0.5, 0.5),
				new ArtworkPointRow(2, 12L, 0.0, -0.5));
		when(artworkMapper.findRoundById(1L)).thenReturn(round());
		when(artworkMapper.findPoints(5L)).thenReturn(triangle);
		when(port.evaluate(any(), anyString(), anyList())).thenReturn(Optional.empty());
		ArtworkRow closed = artwork();
		closed.setClosed(true);

		service.evaluate(closed);

		ArgumentCaptor<byte[]> png = ArgumentCaptor.forClass(byte[].class);
		verify(port).evaluate(png.capture(), anyString(), anyList());
		ArtworkRenderer same = new ArtworkRenderer(64, 0.02, 0.008f);
		assertThat(png.getValue()).isEqualTo(same.render(triangle, true));
		assertThat(png.getValue()).isNotEqualTo(same.render(triangle, false));
	}

	private void givenArtworkWithPoints() {
		when(artworkMapper.findRoundById(1L)).thenReturn(round());
		when(artworkMapper.findPoints(5L)).thenReturn(List.of(
				new ArtworkPointRow(0, 10L, -0.5, 0.5), new ArtworkPointRow(1, 11L, 0.5, -0.5)));
	}

	private static ArtworkRow artwork() {
		ArtworkRow row = new ArtworkRow();
		row.setId(5L);
		row.setRoundId(1L);
		row.setEmail("owner@ody.com");
		row.setStatus(ArtworkStatus.PENDING.name());
		row.setCreatedAt(OffsetDateTime.now());
		return row;
	}

	private static ArtworkRoundRow round() {
		ArtworkRoundRow row = new ArtworkRoundRow();
		row.setId(1L);
		row.setTheme("고양이");
		row.setThemePrompt("고양이를 얼마나 닮았는지 채점하라.");
		return row;
	}
}
