package com.ssafy.backend.music.detail;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.ssafy.backend.music.dto.Location;
import com.ssafy.backend.music.dto.MusicDetail;
import com.ssafy.backend.music.dto.NeighborTrack;

/**
 * 노래 상세·주변곡 조회 port (정본 §3.2). BE2가 계약 소유, BE4가 저장소·KNN 실행 구현(헌법 X).
 *
 * 계약:
 * - findDetail: id로 상세 1건. 없으면 Optional.empty (서비스가 MUSIC_NOT_FOUND 404로 변환).
 * - findNeighbors: 임베딩 공간 최근접 k곡. 상세 대상 곡 자신 제외, distance 오름차순(동률 id 오름차순),
 *   재생 불가(youtubeUrl null) 곡도 포함. 후보가 k 미만이면 있는 만큼.
 * - 거리 척도 = 서빙 baseline(v2.1-pca16). 계산식·인덱스는 BE4 확정(B-D).
 *
 * ponytail: 인터페이스만 정의. 어댑터(MyBatis MusicDetailMapper) 구현은 BE4 저장소·KNN 확정 후(B-D).
 */
public interface MusicDetailReader {

	Optional<MusicDetail> findDetail(long id);

	List<NeighborTrack> findNeighbors(long id, int k);

	/**
	 * 곡들의 서빙 좌표를 일괄 조회한다 (별자리 배치용, BACKEND-NOTES A-9).
	 *
	 * <h2>계약</h2>
	 * <ul>
	 *   <li><b>한 번의 조회</b>로 처리한다. 곡당 왕복 금지(FR-011).</li>
	 *   <li>요청한 id 중 <b>없는 것은 결과에 키가 없다</b>(예외 아님). 좌표가 NULL 인 곡도 같다 —
	 *       0 으로 채우지 않는다. 누락 판정은 호출자 책임이다(FR-014).</li>
	 *   <li>좌표는 서빙 번들 원본 그대로다. 반올림·재계산 없음.</li>
	 *   <li>부수효과 없음. 조회 전용. 최대 30건.</li>
	 * </ul>
	 */
	Map<Long, Location> findLocationsByIds(List<Long> ids);

	/**
	 * id 목록으로 곡 상세를 일괄 조회한다 (플레이리스트 상세 조립용).
	 *
	 * <p><b>순서를 보장하지 않는다</b> — {@code IN} 은 입력 순서를 보존하지 않으므로 호출자가 id 키로
	 * 재조립한다({@code JourneyTrackReader} 와 같은 규칙). 없는 id 는 결과에서 빠진다(예외 아님).
	 * 곡당 왕복을 없애는 것이 목적이므로 <b>한 번의 조회</b>로 처리한다.
	 */
	List<MusicDetail> findDetailsByIds(List<Long> ids);
}
