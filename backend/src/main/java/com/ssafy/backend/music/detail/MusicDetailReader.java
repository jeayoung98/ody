package com.ssafy.backend.music.detail;

import java.util.List;
import java.util.Optional;

import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.music.dto.MusicSummary;
import com.ssafy.backend.music.dto.NeighborTrack;

/**
 * 노래 상세·주변곡 조회 port (정본 §3.2). BE2가 계약 소유, BE4가 저장소·KNN 실행 구현(헌법 X).
 *
 * 계약:
 * - findDetail: id로 상세 1건. 없으면 Optional.empty (서비스가 MUSIC_NOT_FOUND 404로 변환).
 * - 이웃 선정은 이 port 가 아니라 NeighborSelection 이 한다(005 FR-023) — 주변 탐색과 곡 상세가
 *   같은 규칙을 써야 해서 2026-09-13 에 옮겼다.
 * - 거리 척도 = 서빙 baseline(v2.1-pca16). 계산식·인덱스는 BE4 확정(B-D).
 *
 * ponytail: 인터페이스만 정의. 어댑터(MyBatis MusicDetailMapper) 구현은 BE4 저장소·KNN 확정 후(B-D).
 */
public interface MusicDetailReader {

	Optional<MusicDetail> findDetail(long id);

	/**
	 * mbid 로 곡 요약을 일괄 조회한다 (005 FR-003).
	 *
	 * <p>선정이 끝난 <b>최종 목록에만</b> 부르는 용도다 — 후보 전체에 장르를 조인하면 그 비용이 그대로
	 * 지연이 된다. 그래서 이웃 후보 단계의 {@code TrackCandidate} 에는 앨범·장르가 없다.
	 *
	 * <p><b>순서를 보장하지 않는다</b>({@code IN} 이 입력 순서를 보존하지 않는다). 호출자가 재조립한다.
	 * 요청한 mbid 중 없는 것은 결과에서 빠진다.
	 */
	List<MusicSummary> findSummariesByMbids(List<String> mbids);
}
