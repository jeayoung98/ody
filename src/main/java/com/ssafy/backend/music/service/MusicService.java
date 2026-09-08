package com.ssafy.backend.music.service;

import org.springframework.stereotype.Service;

import com.ssafy.backend.music.dto.MajorResponse;

@Service
public class MusicService {

	/**
	 * 대표곡 조회 (정본 §3.4). level에 따라 사용하는 PC 축 개수가 달라진다.
	 *
	 * @param level  지도 확대 단계 (>=1)
	 * @param center pc1~pc16 중심 좌표. 미전달 축은 null (level=1은 전부 null 가능).
	 *
	 * ponytail: 대표곡 KNN/거리 산정은 BE4 검색 인터페이스 대기 중. 인터페이스 확정 시 여기서 호출한다.
	 * 거리 척도 baseline = v2.1-pca16.
	 */
	public MajorResponse getMajor(int level, Double[] center) {
		throw new UnsupportedOperationException("music/major: BE4 검색 인터페이스 대기 중");
	}
}
