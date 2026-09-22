package com.ssafy.backend.artwork;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
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
		when(port.evaluate(any(), anyString()))
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
		when(port.evaluate(any(), anyString())).thenReturn(Optional.empty());

		service.evaluate(artwork());

		verify(artworkMapper).markFailed(eq(5L), anyString());
		verify(artworkMapper, never()).markScored(anyLong(), anyInt(), anyString(), anyString());
	}

	/** 평가 중에 소유자가 작품을 지웠으면 markScored 가 0행이다. 그대로 끝낸다 — 예외를 던지지 않는다. */
	@Test
	void discardsResult_whenArtworkGone() {
		givenArtworkWithPoints();
		when(port.evaluate(any(), anyString()))
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
		verify(port, never()).evaluate(any(), anyString());
	}

	@Test
	void writesFailed_whenNoPoints() {
		when(artworkMapper.findRoundById(1L)).thenReturn(round());
		when(artworkMapper.findPoints(5L)).thenReturn(List.of());

		service.evaluate(artwork());

		verify(artworkMapper).markFailed(eq(5L), anyString());
		verify(port, never()).evaluate(any(), anyString());
	}

	/** 포트가 예외를 던져도 밖으로 새지 않는다 — 한 작품의 실패가 배치를 멈추면 안 된다. */
	@Test
	void writesFailed_whenPortThrows() {
		givenArtworkWithPoints();
		when(port.evaluate(any(), anyString())).thenThrow(new IllegalStateException("boom"));

		service.evaluate(artwork());

		verify(artworkMapper).markFailed(eq(5L), anyString());
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
