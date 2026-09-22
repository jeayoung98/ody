package com.ssafy.backend.artwork.render;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.Ellipse2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;

import javax.imageio.ImageIO;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.ssafy.backend.artwork.dto.ArtworkPointRow;

/**
 * 작품 좌표를 PNG 로 그린다 (S15P21A405-563).
 *
 * <p><b>채점 대상 이미지는 서버가 만든다.</b> 프론트가 그린 캔버스를 받으면 제출자가 임의의 고양이
 * 사진을 넣어 점수를 올릴 수 있다 — 리더보드는 경쟁이므로 채점 대상을 서버가 소유해야 한다
 * (spec FR-015).
 *
 * <p>JDK 표준 {@code java.awt} + {@code javax.imageio} 만 쓴다. 이미지 라이브러리를 더하지 않는다.
 * 헤드리스에서 동작하며(Spring Boot 가 {@code java.awt.headless=true} 를 기본으로 켠다) 글자를
 * 그리지 않으므로 서버 글꼴 설치 여부에 좌우되지 않는다.
 *
 * <p><b>같은 좌표면 같은 바이트가 나와야 한다</b> — 시간·난수·글꼴을 쓰지 않는 이유다. 점수는 이
 * 그림에 매겨진 것이라 재현되지 않으면 나중에 무엇이 채점됐는지 알 수 없다.
 */
@Component
public class ArtworkRenderer {

	private static final Color BACKGROUND = Color.BLACK;
	private static final Color FOREGROUND = Color.WHITE;

	/** 좌표 -1~1 이 가장자리에 붙지 않도록 남기는 여백 비율. */
	private static final double MARGIN_RATIO = 0.08;

	private final int size;
	private final double dotRadiusRatio;
	private final float strokeWidthRatio;

	public ArtworkRenderer(
			@Value("${ody.artwork.render.size:512}") int size,
			@Value("${ody.artwork.render.dot-radius-ratio:0.016}") double dotRadiusRatio,
			@Value("${ody.artwork.render.stroke-width-ratio:0.006}") float strokeWidthRatio) {
		this.size = size;
		this.dotRadiusRatio = dotRadiusRatio;
		this.strokeWidthRatio = strokeWidthRatio;
	}

	/**
	 * 점을 {@code position} 순서대로 선으로 잇고 각 점에 원을 찍는다.
	 * 잇는 순서는 프론트 별자리 뷰와 같다(PATH-01 — 플레이리스트는 담은 순서).
	 *
	 * @param points {@code position} 오름차순. 비어 있으면 배경만 있는 이미지가 나온다
	 * @return PNG 바이트
	 */
	public byte[] render(List<ArtworkPointRow> points) {
		BufferedImage image = new BufferedImage(size, size, BufferedImage.TYPE_INT_RGB);
		Graphics2D g = image.createGraphics();
		try {
			g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
			g.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);

			g.setColor(BACKGROUND);
			g.fillRect(0, 0, size, size);

			g.setColor(FOREGROUND);
			g.setStroke(new BasicStroke(size * strokeWidthRatio, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));

			for (int i = 1; i < points.size(); i++) {
				ArtworkPointRow from = points.get(i - 1);
				ArtworkPointRow to = points.get(i);
				g.drawLine(toPixelX(from.getX()), toPixelY(from.getY()), toPixelX(to.getX()), toPixelY(to.getY()));
			}

			double radius = size * dotRadiusRatio;
			for (ArtworkPointRow point : points) {
				double cx = toPixelX(point.getX());
				double cy = toPixelY(point.getY());
				g.fill(new Ellipse2D.Double(cx - radius, cy - radius, radius * 2, radius * 2));
			}
		} finally {
			g.dispose();
		}

		ByteArrayOutputStream out = new ByteArrayOutputStream();
		try {
			ImageIO.write(image, "png", out);
		} catch (IOException e) {
			// ByteArrayOutputStream 은 IO 가 없다. 여기 오면 PNG writer 자체가 없는 것이다.
			throw new UncheckedIOException("작품 이미지를 PNG 로 인코딩하지 못했다", e);
		}
		return out.toByteArray();
	}

	private int toPixelX(double x) {
		return (int) Math.round(toPixel(x));
	}

	/** 화면 y 는 아래로 자라고 좌표 y 는 위가 양수다. 뒤집지 않으면 그림이 상하로 뒤집힌다. */
	private int toPixelY(double y) {
		return (int) Math.round(toPixel(-y));
	}

	private double toPixel(double normalized) {
		double clamped = Math.max(-1.0, Math.min(1.0, normalized));
		double usable = size * (1.0 - 2 * MARGIN_RATIO);
		return size * MARGIN_RATIO + (clamped + 1.0) / 2.0 * usable;
	}
}
