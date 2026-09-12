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
import com.ssafy.backend.music.dto.MusicGenreRow;
import com.ssafy.backend.music.mapper.MusicDetailMapper;

@ExtendWith(MockitoExtension.class)
@DisplayName("JourneyTrackReaderAdapter — 정거장 상세 일괄 조회")
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
		assertThat(adapter.findDetailsByMbids(List.of())).isEmpty();
		verify(mapper, never()).findByMbids(anyList());
		verify(mapper, never()).findGenresByMusicIds(anyList());
	}

	@Test
	@DisplayName("정거장 20건을 질의 2회로 읽는다 — 곡당 왕복이면 예산을 넘는다")
	void readsAllStationsInTwoQueries() {
		List<String> mbids = new java.util.ArrayList<>();
		List<MusicDetailRow> rows = new java.util.ArrayList<>();
		for (int i = 1; i <= 20; i++) {
			mbids.add("mbid-" + i);
			rows.add(row(i, "mbid-" + i, "곡 " + i, "아티스트"));
		}
		given(mapper.findByMbids(mbids)).willReturn(rows);
		given(mapper.findGenresByMusicIds(anyList())).willReturn(List.of());

		assertThat(adapter.findDetailsByMbids(mbids)).hasSize(20);
		verify(mapper).findByMbids(mbids);
		verify(mapper).findGenresByMusicIds(anyList());
	}

	@Test
	@DisplayName("없는 mbid 는 결과에서 빠진다 — 예외로 만들지 않는다(누락 판정은 호출자 몫)")
	void missingMbidIsOmitted() {
		given(mapper.findByMbids(anyList()))
				.willReturn(List.of(row(1, "있음", "제목", "가수")));
		given(mapper.findGenresByMusicIds(anyList())).willReturn(List.of());

		List<MusicDetail> found = adapter.findDetailsByMbids(List.of("있음", "없음"));

		assertThat(found).hasSize(1);
		assertThat(found.get(0).mbid()).isEqualTo("있음");
	}

	@Test
	@DisplayName("장르를 곡별로 묶어 채운다")
	void fillsGenresPerTrack() {
		given(mapper.findByMbids(anyList()))
				.willReturn(List.of(row(1, "a", "제목1", "가수1"), row(2, "b", "제목2", "가수2")));
		MusicGenreRow g1 = new MusicGenreRow();
		g1.setMusicId(1L);
		g1.setName("rock");
		MusicGenreRow g2 = new MusicGenreRow();
		g2.setMusicId(1L);
		g2.setName("pop");
		given(mapper.findGenresByMusicIds(anyList())).willReturn(List.of(g1, g2));

		List<MusicDetail> found = adapter.findDetailsByMbids(List.of("a", "b"));

		assertThat(found.get(0).genres()).containsExactly("rock", "pop");
		assertThat(found.get(1).genres()).isEmpty();
	}

	@Test
	@DisplayName("한 건도 못 찾으면 장르 질의를 하지 않는다")
	void noRowsSkipsGenreQuery() {
		given(mapper.findByMbids(anyList())).willReturn(List.of());

		assertThat(adapter.findDetailsByMbids(List.of("없음"))).isEmpty();
		verify(mapper, never()).findGenresByMusicIds(anyList());
	}
}
