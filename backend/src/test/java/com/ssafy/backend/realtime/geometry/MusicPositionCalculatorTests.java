package com.ssafy.backend.realtime.geometry;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.ssafy.backend.realtime.config.RealtimeProperties;

class MusicPositionCalculatorTests {

	/** 축 개수·grid 를 받아 [-10,10] 대칭 범위 설정을 만든다(4축 → 2레이어). */
	private MusicPositionCalculator mapper(int grid, int axisCount) {
		List<RealtimeProperties.AxisRange> ar = new ArrayList<>();
		for (int a = 1; a <= axisCount; a++) {
			ar.add(new RealtimeProperties.AxisRange(a, -10.0, 10.0));
		}
		RealtimeProperties.ViewportSettings vp = new RealtimeProperties.ViewportSettings(
				grid, Math.min(36, grid * grid), 20, 64, 250, 5000);
		return new MusicPositionCalculator(new RealtimeProperties(null, null, vp,  ar));
	}

	@Test
	@DisplayName("레이어0은 PC1·PC2 축, 중앙값 0 은 정규화 0.5 → 셀 grid/2")
	void layer0_center() {
		MusicPositionCalculator m = mapper(4, 4);
		MusicPositionCalculator.Placement p = m.calculate(new double[] {0, 0, 0, 0}, 0);
		assertThat(p.axisX()).isEqualTo(1);
		assertThat(p.axisY()).isEqualTo(2);
		assertThat(p.xNorm()).isEqualTo(0.5);
		assertThat(p.yNorm()).isEqualTo(0.5);
		assertThat(p.cellX()).isEqualTo(2);
		assertThat(p.cellY()).isEqualTo(2);
		assertThat(p.cellKey()).isEqualTo("2:2");
	}

	@Test
	@DisplayName("레이어1은 PC3·PC4 축을 읽는다 (프론트 pc[2]·pc[3])")
	void layer1_usesAxes3and4() {
		MusicPositionCalculator m = mapper(16, 4);
		// pc = [1,2,3,4] → 레이어1은 pc[2]=3(x), pc[3]=4(y)
		MusicPositionCalculator.Placement p = m.calculate(new double[] {1, 2, 3, 4}, 1);
		assertThat(p.axisX()).isEqualTo(3);
		assertThat(p.axisY()).isEqualTo(4);
		// 3 → (3+10)/20 = 0.65, 4 → 0.70
		assertThat(p.xNorm()).isCloseTo(0.65, within(1e-9));
		assertThat(p.yNorm()).isCloseTo(0.70, within(1e-9));
	}

	@Test
	@DisplayName("범위 밖 좌표는 가장자리 셀(0 / grid-1)로 clamp")
	void outOfRange_clampsToEdge() {
		MusicPositionCalculator m = mapper(4, 4);
		MusicPositionCalculator.Placement p = m.calculate(new double[] {100, -100, 0, 0}, 0);
		assertThat(p.cellX()).isEqualTo(3);  // > max → grid-1
		assertThat(p.cellY()).isEqualTo(0);  // < min → 0
	}

	@Test
	@DisplayName("합친 셀의 가운데를 지도에서 쓰는 위치로 바꾼다")
	void findsRawCenterOfCombinedCell() {
		MusicPositionCalculator m = mapper(16, 4);

		// 레이어 1 = PC3·PC4 (0-based)
		MusicPositionCalculator.CellCenter center = m.findCellCenter(1, 2, 3, 8);

		assertThat(center.x()).isCloseTo(-3.75, within(1e-9));
		assertThat(center.y()).isCloseTo(-1.25, within(1e-9));
	}

	@Test
	@DisplayName("레이어 수 이상의 번호는 예외 (4축 → 유효 0·1)")
	void layerBeyondMax_throws() {
		MusicPositionCalculator m = mapper(4, 4); // 4축 → 레이어 2개(0, 1)
		assertThat(m.maxLayer()).isEqualTo(2);
		assertThatThrownBy(() -> m.calculate(new double[] {0, 0, 0, 0}, 2))
				.isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	@DisplayName("pc 길이가 축 인덱스보다 짧으면 예외")
	void shortPc_throws() {
		MusicPositionCalculator m = mapper(4, 4);
		assertThatThrownBy(() -> m.calculate(new double[] {0, 0}, 1)) // 레이어1은 pc[3] 필요
				.isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	@DisplayName("축 누락·min>=max 설정은 생성 시 예외")
	void badConfig_throws() {
		RealtimeProperties.ViewportSettings vp = new RealtimeProperties.ViewportSettings(4, 16, 20, 64, 250, 5000);
		// min >= max
		List<RealtimeProperties.AxisRange> bad = List.of(
				new RealtimeProperties.AxisRange(1, 5.0, 5.0),
				new RealtimeProperties.AxisRange(2, -1.0, 1.0));
		assertThatThrownBy(() -> new MusicPositionCalculator(new RealtimeProperties(null, null, vp,  bad)))
				.isInstanceOf(IllegalStateException.class);
	}
}
