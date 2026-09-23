package com.ssafy.backend.artwork;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import com.ssafy.backend.artwork.dto.CatPlaylistResponse;
import com.ssafy.backend.artwork.dto.DrawRequest;
import com.ssafy.backend.artwork.dto.DrawResponse;
import com.ssafy.backend.artwork.dto.MusicPc12Row;
import com.ssafy.backend.artwork.dto.Pc12BoundsRow;
import com.ssafy.backend.artwork.mapper.ArtworkMapper;
import com.ssafy.backend.artwork.service.CatPlaylistGenerator;
import com.ssafy.backend.artwork.template.CatTemplate;
import com.ssafy.backend.common.ArtworkErrorCode;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;
import com.ssafy.backend.music.dto.ConstellationLayoutResponse;
import com.ssafy.backend.music.dto.ConstellationPoint;
import com.ssafy.backend.music.service.ConstellationService;
import com.ssafy.backend.playlist.dto.PlaylistCreateResponse;
import com.ssafy.backend.playlist.service.PlaylistService;

/**
 * 템플릿에서 플레이리스트를 만드는 규칙 (S15P21A405-595).
 *
 * <p>DB 대신 <b>격자 위의 가상 곡</b>을 쓴다 — 최근접 조회가 "요청 좌표를 격자에 붙인 곡" 을 돌려주게 해서,
 * 중복 회피·순서 보존·오차 계산을 결정적으로 검증한다.
 */
class CatPlaylistGeneratorTests {

	private static final String EMAIL = "owner@ody.com";

	/** 곡이 이 간격의 격자 위에 있다고 본다. 두 템플릿 점이 같은 격자칸에 떨어지면 두 번째는 이웃 칸 곡을 받는다. */
	private static final double GRID = 0.5;

	private ArtworkMapper mapper;
	private PlaylistService playlistService;
	private ConstellationService constellationService;
	private CatPlaylistGenerator generator;

	@BeforeEach
	void setUp() {
		mapper = Mockito.mock(ArtworkMapper.class);
		playlistService = Mockito.mock(PlaylistService.class);
		constellationService = Mockito.mock(ConstellationService.class);
		generator = new CatPlaylistGenerator(mapper, playlistService, constellationService);

		Pc12BoundsRow box = new Pc12BoundsRow();
		box.setXMin(-10);
		box.setXMax(10);
		box.setYMin(-6);
		box.setYMax(6);
		when(mapper.findPc12Bounds()).thenReturn(box);

		// 격자 곡: (x, y) 에 가장 가까운 곡부터 8개. id 는 격자 좌표에서 결정적으로 만든다.
		when(mapper.findNearestMusicByPc12(anyDouble(), anyDouble(), anyInt())).thenAnswer(inv -> {
			double x = inv.getArgument(0);
			double y = inv.getArgument(1);
			int limit = inv.getArgument(2);
			return gridNeighbours(x, y, limit);
		});

		when(playlistService.create(anyString(), anyString(), any())).thenAnswer(inv -> {
			List<Long> ids = inv.getArgument(2);
			return new PlaylistCreateResponse(77L, inv.getArgument(1), ids.size());
		});
		when(constellationService.layout(any())).thenAnswer(inv -> {
			List<Long> ids = inv.getArgument(0);
			return new ConstellationLayoutResponse(ids.stream().map(id -> new ConstellationPoint(id, 0, 0)).toList());
		});
	}

	@Test
	void rejectsUnknownTemplate() {
		assertThatThrownBy(() -> generator.generate("dog", EMAIL))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(GlobalErrorCode.INVALID_INPUT);

		verify(playlistService, never()).create(anyString(), anyString(), any());
	}

	@Test
	void picksOneDistinctSongPerTemplatePoint_inPathOrder() {
		CatPlaylistResponse response = generator.generate("sitting", EMAIL);

		@SuppressWarnings("unchecked")
		ArgumentCaptor<List<Long>> ids = ArgumentCaptor.forClass(List.class);
		verify(playlistService).create(eq(EMAIL), anyString(), ids.capture());

		assertThat(ids.getValue()).hasSize(CatTemplate.SITTING.points().size());
		assertThat(ids.getValue()).doesNotHaveDuplicates();
		assertThat(response.musicCnt()).isEqualTo(ids.getValue().size());
		assertThat(response.template()).isEqualTo("sitting");
		assertThat(response.playlistId()).isEqualTo(77L);
		// 응답 좌표는 배치 API 결과 그대로, 같은 개수·같은 순서.
		assertThat(response.points()).extracting("musicId").containsExactlyElementsOf(ids.getValue());
	}

	@Test
	void templateNameIsCaseInsensitive() {
		assertThat(generator.generate("  Loaf ", EMAIL).template()).isEqualTo("loaf");
	}

	@Test
	void fitError_isNonNegativeAndBounded() {
		CatPlaylistResponse response = generator.generate("sketch", EMAIL);

		// 격자 간격 0.5, 반폭은 최소 6*0.5=3 → 한 점의 최대 어긋남은 대각 반칸 ≈ 0.354, 반폭 대비 0.12 미만.
		// 중복 회피로 이웃 칸을 받아도 두 칸 이내다.
		assertThat(response.fitError()).isGreaterThanOrEqualTo(0.0).isLessThan(0.5);
	}

	/** 상자는 한 번만 읽는다 — 요청마다 전체 곡을 훑으면 안 된다. */
	@Test
	void readsBoundsOnce() {
		generator.generate("sitting", EMAIL);
		generator.generate("loaf", EMAIL);

		verify(mapper, times(1)).findPc12Bounds();
	}

	@Test
	void playlistName_containsTemplateLabel() {
		generator.generate("loaf", EMAIL);

		ArgumentCaptor<String> name = ArgumentCaptor.forClass(String.class);
		verify(playlistService).create(eq(EMAIL), name.capture(), any());
		assertThat(name.getValue()).startsWith("고양이 엎드린 고양이 ");
	}

	@Test
	void templates_listAllWithPointCounts() {
		assertThat(generator.templates()).hasSize(CatTemplate.ALL.size());
		assertThat(generator.templates().get(0).pointCount()).isEqualTo(CatTemplate.SITTING.points().size());
	}

	// ---------------- 그린 별자리 (S15P21A405-598) ----------------

	/** 캔버스 좌표(0~1, y 아래) 오각형 5점. */
	private static final List<DrawRequest.DrawPoint> PENTAGON = List.of(
			new DrawRequest.DrawPoint(0.50, 0.10), new DrawRequest.DrawPoint(0.90, 0.40),
			new DrawRequest.DrawPoint(0.75, 0.90), new DrawRequest.DrawPoint(0.25, 0.90),
			new DrawRequest.DrawPoint(0.10, 0.40));

	/** draw 는 모양을 점수로 비교하므로 layout 목이 실제 격자 좌표를 돌려줘야 한다(기본 목은 전부 원점). */
	private void layoutReturnsGridCoordinates() {
		// when(...) 로 다시 걸면 setUp 의 답변이 null 인자로 한 번 실행된다 — doAnswer 로 건다.
		Mockito.doAnswer(inv -> {
			List<Long> ids = inv.getArgument(0);
			return new ConstellationLayoutResponse(ids.stream()
					.map(id -> new ConstellationPoint(id, gridX(id), gridY(id)))
					.toList());
		}).when(constellationService).layout(any());
	}

	@Test
	void draw_oneDistinctSongPerPoint_inInputOrder_matchingLayout() {
		layoutReturnsGridCoordinates();

		DrawResponse response = generator.draw(PENTAGON);

		assertThat(response.points()).hasSize(PENTAGON.size());
		assertThat(response.points()).extracting("musicId").doesNotHaveDuplicates();
		@SuppressWarnings("unchecked")
		ArgumentCaptor<List<Long>> ids = ArgumentCaptor.forClass(List.class);
		verify(constellationService).layout(ids.capture());
		// 응답 = 배치 API 결과 그대로, 입력 점 순서 그대로 (FR-011, SC-002)
		assertThat(response.points()).extracting("musicId").containsExactlyElementsOf(ids.getValue());
		assertThat(response.points().get(0).x()).isEqualTo(gridX(ids.getValue().get(0)));
		assertThat(response.score()).isBetween(0, 100);
		assertThat(response.quality()).isIn("HIGH", "MEDIUM", "LOW");
	}

	@Test
	void draw_sameInput_sameResult() {
		layoutReturnsGridCoordinates();

		assertThat(generator.draw(PENTAGON)).isEqualTo(generator.draw(PENTAGON));
	}

	@Test
	void draw_doesNotCreatePlaylist() {
		layoutReturnsGridCoordinates();

		generator.draw(PENTAGON);

		verify(playlistService, never()).create(anyString(), anyString(), any());
	}

	@Test
	void draw_keepsDrawnOrientation_soShapeScoresHigh() {
		layoutReturnsGridCoordinates();

		// 격자 0.5 · 반폭 6 이면 한 점 오차가 반폭의 수 % — 오각형이면 점수 90 이상(HIGH)이어야 한다.
		DrawResponse response = generator.draw(PENTAGON);

		assertThat(response.quality()).isEqualTo("HIGH");
	}

	@Test
	void draw_rejectsCollapsedDrawing() {
		List<DrawRequest.DrawPoint> collapsed = List.of(
				new DrawRequest.DrawPoint(0.500, 0.500), new DrawRequest.DrawPoint(0.505, 0.502),
				new DrawRequest.DrawPoint(0.498, 0.509));

		assertThatThrownBy(() -> generator.draw(collapsed))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(ArtworkErrorCode.ARTWORK_DRAWING_DEGENERATE);
		verify(mapper, never()).findNearestMusicByPc12(anyDouble(), anyDouble(), anyInt());
	}

	@Test
	void draw_straightLine_isValid() {
		layoutReturnsGridCoordinates();

		DrawResponse response = generator.draw(List.of(
				new DrawRequest.DrawPoint(0.1, 0.5), new DrawRequest.DrawPoint(0.5, 0.5),
				new DrawRequest.DrawPoint(0.9, 0.5)));

		assertThat(response.points()).hasSize(3);
	}

	@Test
	void draw_repeatedPoint_getsTwoDifferentSongs() {
		layoutReturnsGridCoordinates();

		DrawResponse response = generator.draw(List.of(
				new DrawRequest.DrawPoint(0.2, 0.2), new DrawRequest.DrawPoint(0.2, 0.2),
				new DrawRequest.DrawPoint(0.8, 0.8)));

		assertThat(response.points()).extracting("musicId").doesNotHaveDuplicates().hasSize(3);
	}

	/** 기동 예열 뒤에는 요청이 상자를 다시 읽지 않는다 (research R4). */
	@Test
	void warmUp_fillsBoundsCache() {
		layoutReturnsGridCoordinates();

		generator.warmUpBounds();
		generator.draw(PENTAGON);
		generator.generate("loaf", EMAIL);

		verify(mapper, times(1)).findPc12Bounds();
	}

	/** 예열이 실패해도(예: H2 에 percentile_cont 없음) 조용히 끝나고, 첫 요청이 다시 읽는다. */
	@Test
	void warmUp_failure_isSwallowed_andRequestRetries() {
		layoutReturnsGridCoordinates();
		Pc12BoundsRow box = new Pc12BoundsRow();
		box.setXMin(-10);
		box.setXMax(10);
		box.setYMin(-6);
		box.setYMax(6);
		when(mapper.findPc12Bounds()).thenThrow(new IllegalStateException("no percentile_cont")).thenReturn(box);

		generator.warmUpBounds();
		generator.draw(PENTAGON);

		verify(mapper, times(2)).findPc12Bounds();
	}

	// ---------------- 격자 가상 곡 ----------------

	private static double gridX(long id) {
		return ((id - 1_000_000L) / 1000 - 500) * GRID;
	}

	private static double gridY(long id) {
		return ((id - 1_000_000L) % 1000 - 500) * GRID;
	}

	/** (x, y) 주변 격자점을 가까운 순으로 limit 개. 곡 id = 격자 좌표 해시(결정적, 칸마다 고유). */
	private static List<MusicPc12Row> gridNeighbours(double x, double y, int limit) {
		long gx = Math.round(x / GRID);
		long gy = Math.round(y / GRID);
		List<MusicPc12Row> out = new ArrayList<>();
		for (int r = 0; r <= 3 && out.size() < limit; r++) {
			for (long dx = -r; dx <= r; dx++) {
				for (long dy = -r; dy <= r; dy++) {
					if (Math.max(Math.abs(dx), Math.abs(dy)) != r) {
						continue;
					}
					MusicPc12Row row = new MusicPc12Row();
					row.setMusicId(1_000_000L + (gx + dx + 500) * 1000 + (gy + dy + 500));
					row.setPc1((gx + dx) * GRID);
					row.setPc2((gy + dy) * GRID);
					out.add(row);
					if (out.size() >= limit) {
						return out;
					}
				}
			}
		}
		return out;
	}
}
