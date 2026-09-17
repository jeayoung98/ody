package com.ssafy.backend.realtime.geometry;

import java.util.List;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import com.ssafy.backend.realtime.config.RealtimeProperties;

/**
 * 곡의 16차원 좌표 + 레이어 → 격자 셀 배치.
 * "재생 = 위치"(RT-02)에서 좌표 산출 담당.
 * 클라이언트 좌표는 신뢰하지 않고 서버가 music.location 으로 여기서 계산한다.
 * realtime 프로파일에서만 활성(설정 yml 의존). 미활성 boot 에서는 로드되지 않는다.
 * 축 min/max·grid 는 생성 시 배열로 굳혀 calculate() 는 락 없는 순수 계산이 된다.
 */
@Component
@Profile("realtime")
public class MusicPositionCalculator {

	private final int grid;
	private final int maxLayer;
	private final double[] axisMin; // 1-based: index a = PC a (index 0 미사용)
	private final double[] axisMax;

	public MusicPositionCalculator(RealtimeProperties props) {
		this.grid = props.viewport().gridSize();
		List<RealtimeProperties.AxisRange> ranges = props.axisRange();
		if (ranges == null || ranges.isEmpty()) {
			throw new IllegalStateException("realtime.axis-range 설정이 비어 있다(프로파일/yml 확인)");
		}
		int dim = ranges.size();
		this.maxLayer = dim / 2;
		this.axisMin = new double[dim + 1];
		this.axisMax = new double[dim + 1];
		boolean[] seen = new boolean[dim + 1];
		for (RealtimeProperties.AxisRange r : ranges) {
			int a = r.axis();
			if (a < 1 || a > dim) {
				throw new IllegalStateException("axis-range 축 번호 범위 밖: " + a + " (1.." + dim + ")");
			}
			if (r.max() <= r.min()) {
				throw new IllegalStateException(
						"axis-range min<max 위반: axis=" + a + " min=" + r.min() + " max=" + r.max());
			}
			axisMin[a] = r.min();
			axisMax[a] = r.max();
			seen[a] = true;
		}
		for (int a = 1; a <= dim; a++) {
			if (!seen[a]) {
				throw new IllegalStateException("axis-range 누락 축: " + a);
			}
		}
	}

	/** 배치 결과 — 표시 축쌍(1-based)·정규화 좌표(0~1)·격자 셀. */
	public record Placement(int layer, int axisX, int axisY,
			double xNorm, double yNorm, int cellX, int cellY) {
		/**
		 * 격자 셀 좌표 (cellX, cellY) 를 단일 문자열 키 "cellX:cellY" 로 합친다. 예) (3,7) → "3:7".
		 *  - PositionChanged.oldCell/newCell (String, "{cellX}:{cellY}" 형식) 로 이벤트에 실을 때
		 *  - Redis 에서 셀을 키·멤버로 식별할 때(숫자쌍은 키로 못 쓴다)
		 * @return "cellX:cellY" 형식의 셀 키
		 */
		public String cellKey() {
			return cellX + ":" + cellY;
		}
	}

	/**
	 * 화면에 인원수로 표시할 셀의 위치.
	 *
	 * @param x 지도에서 곡과 같은 기준으로 쓰는 가로 위치
	 * @param y 지도에서 곡과 같은 기준으로 쓰는 세로 위치
	 */
	public record CellCenter(double x, double y) {
	}

	/**
	 * 곡 좌표 pc[] 를 해당 레이어의 격자 셀로 배치한다.
	 *
	 * @param pc    곡의 PC 성분 배열(pc[0]=PC1 … 길이 >= 2*maxLayer)
	 * @param layer 1-based 레이어 번호
	 * @return 표시 축쌍·정규화 좌표·격자 셀을 담은 배치 결과
	 * @throws IllegalArgumentException 레이어가 [1, maxLayer] 밖이거나 pc 길이가 부족할 때
	 */
	public Placement calculate(double[] pc, int layer) {
		int[] axes = findAxes(layer);
		int ax = axes[0];
		int ay = axes[1];
		if (pc == null || pc.length < ay) {
			throw new IllegalArgumentException(
					"pc 길이 부족: " + (pc == null ? "null" : pc.length) + " < " + ay);
		}
		double xNorm = CoordinateNormalizer.normalize(pc[ax - 1], axisMin[ax], axisMax[ax]);
		double yNorm = CoordinateNormalizer.normalize(pc[ay - 1], axisMin[ay], axisMax[ay]);
		int cellX = CoordinateNormalizer.cell(xNorm, grid);
		int cellY = CoordinateNormalizer.cell(yNorm, grid);
		return new Placement(layer, ax, ay, xNorm, yNorm, cellX, cellY);
	}

	/** 레이어가 화면에 쓰는 두 축을 찾는다. */
	public int[] findAxes(int layer) {
		return LayerAxisCalculator.findAxes(layer, maxLayer)
				.orElseThrow(() -> new IllegalArgumentException(
						"레이어 범위 밖: " + layer + " (1.." + maxLayer + ")"));
	}

	/** 곡의 한 축 위치를 셀 번호로 바꾼다. */
	public int findCell(double rawPc, int axis) {
		if (axis < 1 || axis >= axisMin.length) {
			throw new IllegalArgumentException("축 범위 밖: " + axis);
		}
		double normalized = CoordinateNormalizer.normalize(rawPc, axisMin[axis], axisMax[axis]);
		return CoordinateNormalizer.cell(normalized, grid);
	}

	/**
	 * 합친 셀의 가운데를 지도에서 사용하는 위치로 계산한다.
	 *
	 * @param layer 현재 레이어
	 * @param cellX 가로 셀 번호
	 * @param cellY 세로 셀 번호
	 * @param cellsPerRow 한 줄에 표시할 셀 수
	 * @return 지도에서 바로 사용할 셀의 가운데 위치
	 */
	public CellCenter findCellCenter(int layer, int cellX, int cellY, int cellsPerRow) {
		int[] axes = findAxes(layer);
		if (cellsPerRow < 1
				|| cellX < 0 || cellX >= cellsPerRow
				|| cellY < 0 || cellY >= cellsPerRow) {
			throw new IllegalArgumentException("셀 번호가 격자 범위를 벗어났다");
		}
		double x = axisMin[axes[0]]
				+ (cellX + 0.5) * (axisMax[axes[0]] - axisMin[axes[0]]) / cellsPerRow;
		double y = axisMin[axes[1]]
				+ (cellY + 0.5) * (axisMax[axes[1]] - axisMin[axes[1]]) / cellsPerRow;
		return new CellCenter(x, y);
	}

	public int maxLayer() {
		return maxLayer;
	}

	public int grid() {
		return grid;
	}
}
