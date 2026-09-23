package com.ssafy.backend.artwork.service;

import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import com.ssafy.backend.artwork.dto.ArtworkPoint;
import com.ssafy.backend.artwork.dto.CatPlaylistResponse;
import com.ssafy.backend.artwork.dto.CatTemplateSummary;
import com.ssafy.backend.artwork.dto.DrawRequest;
import com.ssafy.backend.artwork.dto.DrawResponse;
import com.ssafy.backend.artwork.dto.MusicPc12Row;
import com.ssafy.backend.artwork.dto.Pc12BoundsRow;
import com.ssafy.backend.artwork.mapper.ArtworkMapper;
import com.ssafy.backend.artwork.template.CatTemplate;
import com.ssafy.backend.common.ArtworkErrorCode;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;
import com.ssafy.backend.music.service.ConstellationService;
import com.ssafy.backend.playlist.dto.PlaylistCreateResponse;
import com.ssafy.backend.playlist.service.PlaylistService;

import lombok.extern.slf4j.Slf4j;

/**
 * 고양이 템플릿에 맞는 곡을 골라 플레이리스트를 만든다 (S15P21A405-595).
 *
 * <p>템플릿(-1~1 좌표)을 곡 pc1/pc2 분포 상자 안에 놓고, 점마다 가장 가까운 곡을 중복 없이 고른다.
 * 크기를 몇 단계 바꿔 보며 <b>평균 오차가 가장 작은 배치</b>를 택한다 — 큰 배치는 모양이 뚜렷하지만
 * 곡이 없는 변두리에 점이 걸리고, 작은 배치는 곡은 촘촘하나 가까운 점들이 같은 곡을 다툰다.
 *
 * <p>배치 API({@link ConstellationService#layout})가 pc1/pc2 고정축이므로 여기서 고른 곡의 실제
 * 별자리는 템플릿 모양에서 최근접 오차만큼만 어긋난다. 그 오차를 {@code fitError} 로 돌려준다.
 *
 * <p>ponytail: 점마다 KNN 한 번씩 = 크기 4단계 × 최대 30점 = 120 쿼리. GiST KNN 이 ms 급이라 지금은 문제
 * 없다. 느려지면 상자 안 곡을 한 번에 읽어 메모리에서 고르는 쪽으로 바꾼다.
 */
@Slf4j
@Service
public class CatPlaylistGenerator {

	/** 템플릿을 상자 반폭의 이 비율들로 놓아 보고 오차가 가장 작은 것을 고른다. 큰 것부터. */
	static final double[] SCALES = {1.0, 0.8, 0.65, 0.5};

	/** 점 하나에 후보로 뽑는 곡 수. 앞선 점이 가져간 곡을 건너뛸 여유다. */
	static final int CANDIDATES_PER_POINT = 8;

	/**
	 * 그림 bbox 긴 변이 캔버스의 이 비율보다 작으면 모양이 없다고 본다 (specs/010 research R5).
	 * 한 점을 여러 번 누르거나 손이 떨린 정도다 — 정규화하면 잡음이 모양으로 부풀려진다.
	 */
	static final double MIN_DRAWING_EXTENT = 0.02;

	private static final DateTimeFormatter NAME_SUFFIX = DateTimeFormatter.ofPattern("HHmmss");

	private final ArtworkMapper artworkMapper;
	private final PlaylistService playlistService;
	private final ConstellationService constellationService;

	/** 곡 분포 상자. 곡 데이터가 바뀌지 않는 한 같으므로 한 번만 읽는다. */
	private final AtomicReference<Pc12BoundsRow> bounds = new AtomicReference<>();

	public CatPlaylistGenerator(
			ArtworkMapper artworkMapper, PlaylistService playlistService, ConstellationService constellationService) {
		this.artworkMapper = artworkMapper;
		this.playlistService = playlistService;
		this.constellationService = constellationService;
	}

	/**
	 * 기동 직후 상자를 미리 읽는다 (specs/010 research R4). 백분위 두 개가 전체 곡을 정렬해 운영에서 8.9 s 걸렸다 —
	 * 첫 요청이 그 값을 치르면 제한 시간 10 s 에 거의 닿는다. 메인 스레드에서 돌리면 Blue-Green 헬스체크가 늦어지므로
	 * 데몬 스레드 하나로 띄운다.
	 */
	@EventListener(ApplicationReadyEvent.class)
	public void warmUpBoundsOnReady() {
		Thread thread = new Thread(this::warmUpBounds, "artwork-bounds-warmup");
		thread.setDaemon(true);
		thread.start();
	}

	/** 상자를 읽어 캐시에 채운다. 실패하면 WARN 만 남긴다 — 캐시가 비어 있으니 첫 요청이 다시 읽는다. */
	public void warmUpBounds() {
		long started = System.nanoTime();
		try {
			bounds.updateAndGet(b -> b != null ? b : artworkMapper.findPc12Bounds());
			log.info("[Artwork] 상자 예열 ms={}", (System.nanoTime() - started) / 1_000_000);
		} catch (RuntimeException e) {
			log.warn("[Artwork] 상자 예열 실패 — 첫 요청이 다시 읽는다: {}", e.toString());
		}
	}

	public List<CatTemplateSummary> templates() {
		return CatTemplate.ALL.stream()
				.map(t -> new CatTemplateSummary(t.name(), t.label(), t.points().size()))
				.toList();
	}

	/**
	 * 템플릿으로 내 플레이리스트를 만든다. 제출은 하지 않는다 — 회차당 1작품 정책과 부딪히지 않게
	 * 사용자가 보고 결정한다.
	 *
	 * @throws CustomException 없는 템플릿이면 {@code INVALID_INPUT}
	 */
	public CatPlaylistResponse generate(String templateName, String requesterEmail) {
		CatTemplate template = CatTemplate.find(templateName)
				.orElseThrow(() -> new CustomException(GlobalErrorCode.INVALID_INPUT));

		Placement best = match(template.points());
		if (best == null) {
			// 후보 8곡이 전부 앞선 점에 잡히는 경우 — 곡이 수만 곡인 실 DB 에서는 나오지 않는다.
			throw new IllegalStateException("템플릿 점마다 서로 다른 곡을 고르지 못했다: " + template.name());
		}

		String name = "고양이 " + template.label() + " " + LocalTime.now(ZoneId.of("Asia/Seoul")).format(NAME_SUFFIX);
		PlaylistCreateResponse playlist = playlistService.create(requesterEmail, name, best.musicIds);

		// 응답 좌표는 배치 API 와 같은 함수로 — 프론트가 보는 별자리와 어긋나지 않는다.
		List<ArtworkPoint> points = constellationService.layout(best.musicIds).points().stream()
				.map(p -> new ArtworkPoint(p.musicId(), p.x(), p.y()))
				.toList();

		log.info("[Artwork] 고양이 플리 생성 template={} playlistId={} musicCnt={} scale={} fitError={}",
				template.name(), playlist.playlistId(), best.musicIds.size(), best.scale, best.meanError);
		return new CatPlaylistResponse(
				playlist.playlistId(), name, template.name(), best.musicIds.size(), best.meanError, points);
	}

	/**
	 * 사용자가 그린 별자리에 곡을 대응시킨다 (S15P21A405-598). <b>플레이리스트를 만들지 않는다</b> — 사용자가 결과를
	 * 보고 {@code /api/playlist/create} 로 저장한다.
	 *
	 * <p>그림을 템플릿과 같은 좌표계(-1~1, y 위)로 바꿔 {@link #match} 에 넣고, 고른 곡의 배치 좌표와 그림을
	 * {@link ShapeScore} 로 비교한다. 점 i 는 곡 i 다.
	 *
	 * @param points 캔버스 기준 0~1, x 오른쪽·y 아래. 3~20개(컨트롤러 {@code @Valid})
	 */
	public DrawResponse draw(List<DrawRequest.DrawPoint> points) {
		long started = System.nanoTime();
		if (extent(points) < MIN_DRAWING_EXTENT) {
			throw new CustomException(ArtworkErrorCode.ARTWORK_DRAWING_DEGENERATE);
		}
		List<double[]> shape = normalize(points);

		Placement best = match(shape);
		if (best == null) {
			throw new IllegalStateException("그림 점마다 서로 다른 곡을 고르지 못했다: points=" + points.size());
		}

		// 응답 좌표는 배치 API 와 같은 함수로 — 저장 후 다시 열어도 같은 별자리다(FR-011).
		List<ArtworkPoint> layout = constellationService.layout(best.musicIds).points().stream()
				.map(p -> new ArtworkPoint(p.musicId(), p.x(), p.y()))
				.toList();
		int score = ShapeScore.score(shape, layout.stream().map(p -> new double[] {p.x(), p.y()}).toList());
		ShapeScore.Quality quality = ShapeScore.quality(score);

		log.info("[Artwork] 그림 매칭 points={} score={} quality={} ms={}",
				points.size(), score, quality, (System.nanoTime() - started) / 1_000_000);
		return new DrawResponse(score, quality.name(), layout);
	}

	/** 점들의 bbox 긴 변 (캔버스 비율). */
	private static double extent(List<DrawRequest.DrawPoint> points) {
		double minX = 1;
		double maxX = 0;
		double minY = 1;
		double maxY = 0;
		for (DrawRequest.DrawPoint p : points) {
			minX = Math.min(minX, p.x());
			maxX = Math.max(maxX, p.x());
			minY = Math.min(minY, p.y());
			maxY = Math.max(maxY, p.y());
		}
		return Math.max(maxX - minX, maxY - minY);
	}

	/** 캔버스 좌표(0~1, y 아래) → 템플릿 좌표계: y 반전, 무게중심 이동, 최대 절댓값 1. */
	static List<double[]> normalize(List<DrawRequest.DrawPoint> points) {
		double mx = 0;
		double my = 0;
		for (DrawRequest.DrawPoint p : points) {
			mx += p.x();
			my += 1 - p.y();
		}
		mx /= points.size();
		my /= points.size();

		List<double[]> shape = new ArrayList<>(points.size());
		double span = 0;
		for (DrawRequest.DrawPoint p : points) {
			double x = p.x() - mx;
			double y = (1 - p.y()) - my;
			shape.add(new double[] {x, y});
			span = Math.max(span, Math.max(Math.abs(x), Math.abs(y)));
		}
		for (double[] xy : shape) {
			xy[0] /= span;
			xy[1] /= span;
		}
		return shape;
	}

	/**
	 * 점들(-1~1, y 위)을 곡 분포 상자 중심에 놓고, 크기를 {@link #SCALES} 로 바꿔 보며 평균 오차가 가장 작은
	 * 배치를 고른다. 템플릿({@link #generate})과 그린 별자리({@link #draw})가 같은 경로를 쓴다.
	 *
	 * <p>회전은 탐색하지 않는다 — 곡이 pc1/pc2 평면을 빽빽이 덮어 어느 방향으로 놓아도 오차가 반폭의 0.1% 수준이다
	 * (운영 실측 fitError 0.0005~0.0008, specs/010 research R1).
	 *
	 * @return 최선 배치. 어느 크기에서든 점마다 서로 다른 곡을 고르지 못하면 null
	 */
	private Placement match(List<double[]> points) {
		Pc12BoundsRow box = bounds.updateAndGet(b -> b != null ? b : artworkMapper.findPc12Bounds());
		double cx = (box.getXMin() + box.getXMax()) / 2;
		double cy = (box.getYMin() + box.getYMax()) / 2;
		// 두 축에 같은 배율 — 짧은 축 기준이어야 상자를 벗어나지 않는다.
		double half = Math.min(box.getXMax() - box.getXMin(), box.getYMax() - box.getYMin()) / 2;

		Placement best = null;
		for (double scale : SCALES) {
			Placement placement = place(points, cx, cy, half * scale);
			if (placement != null && (best == null || placement.meanError < best.meanError)) {
				best = placement;
			}
		}
		return best;
	}

	/**
	 * 점들을 (cx, cy) 중심·반폭 {@code halfExtent} 로 놓고 점마다 가장 가까운 미사용 곡을 고른다.
	 *
	 * @return 배치. 어느 점에서든 후보가 전부 사용 중이면 null
	 */
	private Placement place(List<double[]> points, double cx, double cy, double halfExtent) {
		List<Long> musicIds = new ArrayList<>(points.size());
		Set<Long> used = new HashSet<>();
		double totalError = 0;

		for (double[] p : points) {
			double tx = cx + p[0] * halfExtent;
			double ty = cy + p[1] * halfExtent;
			MusicPc12Row chosen = null;
			for (MusicPc12Row candidate : artworkMapper.findNearestMusicByPc12(tx, ty, CANDIDATES_PER_POINT)) {
				if (used.add(candidate.getMusicId())) {
					chosen = candidate;
					break;
				}
			}
			if (chosen == null) {
				return null;
			}
			musicIds.add(chosen.getMusicId());
			totalError += Math.hypot(chosen.getPc1() - tx, chosen.getPc2() - ty) / halfExtent;
		}
		return new Placement(musicIds, totalError / points.size(), halfExtent);
	}

	private record Placement(List<Long> musicIds, double meanError, double scale) {
	}
}
