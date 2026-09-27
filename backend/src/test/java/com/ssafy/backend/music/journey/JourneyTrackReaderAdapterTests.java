package com.ssafy.backend.music.journey;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.music.dto.MusicDetailRow;
import com.ssafy.backend.music.mapper.MusicDetailMapper;

@ExtendWith(MockitoExtension.class)
@DisplayName("JourneyTrackReaderAdapter — 정거장 상세 일괄 조회 (PK id)")
class JourneyTrackReaderAdapterTests {

	@Mock
	MusicDetailMapper mapper;

	@InjectMocks
	JourneyTrackReaderAdapter adapter;

	private static MusicDetailRow row(long id, String mbid, String title, String artist) {
		MusicDetailRow r = new MusicDetailRow();
		r.setId(id);
		r.setMbid(mbid);
		r.setTitle(title);
		r.setArtist(artist);
		r.setDuration(200);
		return r;
	}

	@Test
	@DisplayName("빈 입력이면 질의하지 않는다 — IN () 는 문법 오류다")
	void emptyInputDoesNotQuery() {
		assertThat(adapter.findDetailsByIds(List.of())).isEmpty();
		verify(mapper, never()).findByIds(anyList());
	}

	@Test
	@DisplayName("정거장 20건을 질의 1회로 읽는다 — 곡당 왕복이면 예산을 넘는다")
	void readsAllStationsInOneQuery() {
		List<Long> ids = new java.util.ArrayList<>();
		List<MusicDetailRow> rows = new java.util.ArrayList<>();
		for (int i = 1; i <= 20; i++) {
			ids.add((long) i);
			rows.add(row(i, "mbid-" + i, "곡 " + i, "아티스트"));
		}
		given(mapper.findByIds(ids)).willReturn(rows);

		assertThat(adapter.findDetailsByIds(ids)).hasSize(20);
		verify(mapper).findByIds(ids);
	}

	@Test
	@DisplayName("없는 id 는 결과에서 빠진다 — 예외로 만들지 않는다(누락 판정은 호출자 몫)")
	void missingIdIsOmitted() {
		given(mapper.findByIds(anyList()))
				.willReturn(List.of(row(1, "있음", "제목", "가수")));

		List<MusicDetail> found = adapter.findDetailsByIds(List.of(1L, 2L));

		assertThat(found).hasSize(1);
		assertThat(found.get(0).id()).isEqualTo(1L);
	}
}
