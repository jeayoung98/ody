package com.ssafy.backend.realtime.port;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.ssafy.backend.music.dto.MusicDetailRow;
import com.ssafy.backend.music.mapper.MusicDetailMapper;

class MusicLocationAdapterTest {

	private final MusicDetailMapper mapper = mock(MusicDetailMapper.class);
	private final MusicLocationAdapter adapter = new MusicLocationAdapter(mapper);

	@Test
	@DisplayName("row 의 pc1~pc16 을 순서대로 double[16] 으로 옮긴다")
	void mapsPcInOrder() {
		MusicDetailRow row = new MusicDetailRow();
		row.setPc1(1);   row.setPc2(2);   row.setPc3(3);   row.setPc4(4);
		row.setPc5(5);   row.setPc6(6);   row.setPc7(7);   row.setPc8(8);
		row.setPc9(9);   row.setPc10(10); row.setPc11(11); row.setPc12(12);
		row.setPc13(13); row.setPc14(14); row.setPc15(15); row.setPc16(16);
		when(mapper.findById(42L)).thenReturn(row);

		assertThat(adapter.findLocation(42L)).hasValueSatisfying(pc -> {
			assertThat(pc).hasSize(16);
			for (int i = 0; i < 16; i++) {
				assertThat(pc[i]).isEqualTo(i + 1.0);
			}
		});
	}

	@Test
	@DisplayName("없는 곡(null row)은 Optional.empty")
	void missingSong_empty() {
		when(mapper.findById(999L)).thenReturn(null);
		assertThat(adapter.findLocation(999L)).isEmpty();
	}
}
