package com.ssafy.backend.realtime.geometry;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.ssafy.backend.realtime.config.RealtimeProperties;

class CoordinateMapperTest {

	/** 축 개수·grid 를 받아 [-10,10] 대칭 범위 설정을 만든다(4축 → 2레이어). */
	private CoordinateMapper mapper(int grid, int axisCount) {
		List<RealtimeProperties.AxisRange> ar = new ArrayList<>();
		for (int a = 1; a <= axisCount; a++) {
			ar.add(new RealtimeProperties.AxisRange(a, -10.0, 10.0));
		}
		RealtimeProperties.Viewport vp = new RealtimeProperties.Viewport(grid, 36, 64, 250, 5000);
		return new CoordinateMapper(new RealtimeProperties(null, null, vp,  ar));
	}

	@Test
	@DisplayName("레이어1은 PC1·PC2 축, 중앙값 0 은 정규화 0.5 → 셀 grid/2")
	void layer1_center() {
		CoordinateMapper m = mapper(4, 4);
		CoordinateMapper.Placement p = m.place(new double[] {0, 0, 0, 0}, 1);
		assertThat(p.axisX()).isEqualTo(1);
		assertThat(p.axisY()).isEqualTo(2);
		assertThat(p.xNorm()).isEqualTo(0.5);
		assertThat(p.yNorm()).isEqualTo(0.5);
		assertThat(p.cellX()).isEqualTo(2);
		assertThat(p.cellY()).isEqualTo(2);
		assertThat(p.cellKey()).isEqualTo("2:2");
	}

	@Test
	@DisplayName("레이어2는 PC3·PC4 축을 읽는다")
	void layer2_usesAxes3and4() {
		CoordinateMapper m = mapper(20, 4);
		// pc = [1,2,3,4] → 레이어2는 pc[2]=3(x), pc[3]=4(y)
		CoordinateMapper.Placement p = m.place(new double[] {1, 2, 3, 4}, 2);
		assertThat(p.axisX()).isEqualTo(3);
		assertThat(p.axisY()).isEqualTo(4);
		// 3 → (3+10)/20 = 0.65, 4 → 0.70
		assertThat(p.xNorm()).isCloseTo(0.65, within(1e-9));
		assertThat(p.yNorm()).isCloseTo(0.70, within(1e-9));
	}

	@Test
	@DisplayName("범위 밖 좌표는 가장자리 셀(0 / grid-1)로 clamp")
	void outOfRange_clampsToEdge() {
		CoordinateMapper m = mapper(4, 4);
		CoordinateMapper.Placement p = m.place(new double[] {100, -100, 0, 0}, 1);
		assertThat(p.cellX()).isEqualTo(3);  // > max → grid-1
		assertThat(p.cellY()).isEqualTo(0);  // < min → 0
	}

	@Test
	@DisplayName("maxLayer 초과 레이어는 예외")
	void layerBeyondMax_throws() {
		CoordinateMapper m = mapper(4, 4); // 4축 → maxLayer 2
		assertThat(m.maxLayer()).isEqualTo(2);
		assertThatThrownBy(() -> m.place(new double[] {0, 0, 0, 0}, 3))
				.isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	@DisplayName("pc 길이가 축 인덱스보다 짧으면 예외")
	void shortPc_throws() {
		CoordinateMapper m = mapper(4, 4);
		assertThatThrownBy(() -> m.place(new double[] {0, 0}, 2)) // 레이어2는 pc[3] 필요
				.isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	@DisplayName("축 누락·min>=max 설정은 생성 시 예외")
	void badConfig_throws() {
		RealtimeProperties.Viewport vp = new RealtimeProperties.Viewport(4, 36, 64, 250, 5000);
		// min >= max
		List<RealtimeProperties.AxisRange> bad = List.of(
				new RealtimeProperties.AxisRange(1, 5.0, 5.0),
				new RealtimeProperties.AxisRange(2, -1.0, 1.0));
		assertThatThrownBy(() -> new CoordinateMapper(new RealtimeProperties(null, null, vp,  bad)))
				.isInstanceOf(IllegalStateException.class);
	}
}
