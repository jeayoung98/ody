package com.ssafy.backend.music.service;

import java.util.Comparator;
import java.util.List;

import com.ssafy.backend.music.dto.MusicDetail;

/**
 * 대표곡 선정 순수 로직 (FR-013): 후보를 youtubeCnt 내림차순으로 정렬해 상위 k 곡을 고른다.
 * playCnt·재생 링크 유무는 순위에 영향을 주지 않는다.
 *
 * k 확정값·동률·youtubeCnt 누락·후보 부족·빈 결과 처리는 B4 미정이라 여기서 정하지 않는다.
 * k 는 반드시 주입받는다(하드코딩 금지). 누락 조회수는 임의 순서를 부여하는 대신 거절한다(헌법 IX).
 */
public final class MajorSelection {

	private MajorSelection() {
	}

	public static List<MusicDetail> topByYoutubeCnt(List<MusicDetail> candidates, int k) {
		for (MusicDetail candidate : candidates) {
			if (candidate.youtubeCnt() == null) {
				throw new IllegalArgumentException(
						"youtubeCnt 가 없는 후보(id=%s)의 선정 순서는 B4 미정이다".formatted(candidate.id()));
			}
		}
		// 동률은 stream().sorted() 의 안정 정렬로 입력 순서가 유지되지만, 이는 구현 사실일 뿐 확정 계약이 아니다(B4).
		return candidates.stream()
				.sorted(Comparator.comparingInt(MusicDetail::youtubeCnt).reversed())
				.limit(k)
				.toList();
	}
}
