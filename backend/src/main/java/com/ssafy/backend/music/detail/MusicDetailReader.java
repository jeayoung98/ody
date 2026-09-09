package com.ssafy.backend.music.detail;

import java.util.List;
import java.util.Optional;

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
}
