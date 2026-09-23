package com.ssafy.backend.artwork;

import static org.assertj.core.api.Assertions.assertThat;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.List;

import javax.imageio.ImageIO;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.artwork.dto.ArtworkPointRow;
import com.ssafy.backend.artwork.render.ArtworkRenderer;

/**
 * 채점 대상 이미지를 만드는 규칙 (S15P21A405-563).
 *
 * <p>픽셀 하나하나를 검사하지 않는다. 검사하는 것은 <b>같은 좌표면 같은 바이트</b>라는 성질이다 —
 * 점수는 이 그림에 매겨진 것이라, 재현되지 않으면 나중에 무엇이 채점됐는지 알 수 없다.
 */
class ArtworkRendererTests {

	private static final int SIZE = 128;

	private final ArtworkRenderer renderer = new ArtworkRenderer(SIZE, 0.016, 0.006f);

	private static List<ArtworkPointRow> points() {
		return List.of(
				new ArtworkPointRow(0, 10L, -0.8, 0.5),
				new ArtworkPointRow(1, 11L, 0.0, -0.3),
				new ArtworkPointRow(2, 12L, 0.7, 0.9));
	}

	/** 닫힌 모양이면 마지막 점 → 첫 점 선이 생긴다. 그 선의 중간 픽셀로 본다 (S15P21A405-616). */
	@Test
	void closedDrawsLastToFirstSegment() throws IOException {
		// points() 의 마지막 (0.7, 0.9) 과 첫 (-0.8, 0.5) 의 중간 = (-0.05, 0.7). 다른 두 선과는 멀다.
		int px = pixel(-0.05);
		int py = pixel(-0.7);

		BufferedImage closed = ImageIO.read(new ByteArrayInputStream(renderer.render(points(), true)));
		BufferedImage open = ImageIO.read(new ByteArrayInputStream(renderer.render(points(), false)));

		assertThat(closed.getRGB(px, py)).isNotEqualTo(0xFF000000);
		assertThat(open.getRGB(px, py)).isEqualTo(0xFF000000);
	}

	/** 기준 그림 경로(기존 render)는 열린 모양 그대로다 — 바이트가 같아야 이미 매긴 점수가 유효하다. */
	@Test
	void defaultRenderIsOpen() {
		assertThat(renderer.render(points())).isEqualTo(renderer.render(points(), false));
	}

	/** 렌더러와 같은 식: 여백 8% 를 남기고 -1~1 을 픽셀로. y 는 호출하는 쪽에서 뒤집어 넘긴다. */
	private static int pixel(double normalized) {
		double margin = 0.08;
		return (int) Math.round(SIZE * margin + (normalized + 1.0) / 2.0 * SIZE * (1.0 - 2 * margin));
	}

	@Test
	void sameCoordinatesProduceSameBytes() {
		assertThat(renderer.render(points())).isEqualTo(renderer.render(points()));
	}

	@Test
	void differentCoordinatesProduceDifferentBytes() {
		List<ArtworkPointRow> moved = List.of(
				new ArtworkPointRow(0, 10L, -0.8, 0.5),
				new ArtworkPointRow(1, 11L, 0.0, -0.3),
				new ArtworkPointRow(2, 12L, -0.7, -0.9));

		assertThat(renderer.render(points())).isNotEqualTo(renderer.render(moved));
	}

	@Test
	void outputIsPng() throws IOException {
		byte[] png = renderer.render(points());

		// PNG 시그니처 8바이트.
		assertThat(png).startsWith((byte) 0x89, (byte) 'P', (byte) 'N', (byte) 'G');

		BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(png));
		assertThat(decoded).isNotNull();
		assertThat(decoded.getWidth()).isEqualTo(SIZE);
		assertThat(decoded.getHeight()).isEqualTo(SIZE);
	}

	/** 좌표가 -1~1 의 끝에 있어도 잘려 나가지 않는다 — 여백 안에 들어와야 한다. */
	@Test
	void extremeCoordinatesStayInsideImage() throws IOException {
		List<ArtworkPointRow> corners = List.of(
				new ArtworkPointRow(0, 1L, -1.0, -1.0),
				new ArtworkPointRow(1, 2L, 1.0, 1.0));

		BufferedImage image = ImageIO.read(new ByteArrayInputStream(renderer.render(corners)));

		// 가장자리 한 줄은 배경(검정)으로 남아 있어야 한다.
		for (int i = 0; i < SIZE; i++) {
			assertThat(image.getRGB(i, 0)).isEqualTo(0xFF000000);
			assertThat(image.getRGB(i, SIZE - 1)).isEqualTo(0xFF000000);
			assertThat(image.getRGB(0, i)).isEqualTo(0xFF000000);
			assertThat(image.getRGB(SIZE - 1, i)).isEqualTo(0xFF000000);
		}
	}

	/** y 는 위가 양수다. 뒤집지 않으면 그림이 상하로 뒤집힌 채 채점된다. */
	@Test
	void positiveYIsDrawnAboveNegativeY() throws IOException {
		List<ArtworkPointRow> vertical = List.of(
				new ArtworkPointRow(0, 1L, 0.0, 0.9),
				new ArtworkPointRow(1, 2L, 0.0, -0.9));

		BufferedImage image = ImageIO.read(new ByteArrayInputStream(renderer.render(vertical)));

		int center = SIZE / 2;
		int firstLit = -1;
		for (int y = 0; y < SIZE; y++) {
			if (image.getRGB(center, y) != 0xFF000000) {
				firstLit = y;
				break;
			}
		}
		// y=0.9 인 점이 화면 위쪽(작은 y 픽셀)에 있어야 한다.
		assertThat(firstLit).isBetween(1, center);
	}

	@Test
	void emptyPointsStillRenders() {
		assertThat(renderer.render(List.of())).isNotEmpty();
	}
}
