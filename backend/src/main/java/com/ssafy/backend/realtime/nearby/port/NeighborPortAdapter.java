package com.ssafy.backend.realtime.nearby.port;

import java.util.ArrayList;
import java.util.List;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import com.ssafy.backend.music.dto.Location;
import com.ssafy.backend.music.dto.MusicSummary;
import com.ssafy.backend.music.dto.NearbyCenter;
import com.ssafy.backend.music.dto.NearbyResponse;
import com.ssafy.backend.music.dto.NeighborTrack;
import com.ssafy.backend.music.service.NearbyService;

import lombok.RequiredArgsConstructor;

/**
 * BE2가 이미 만들어둔 "주변 곡 찾기"(music.service.NearbyService)를 그대로 불러다 쓴다.
 * findNearby(내 곡) 하면 내 곡 정보 + 비슷한 곡 최대 10개(제목·가수·좌표·거리)를 준다.
 * BE2가 주는 곡 좌표는 float 인데 우리 좌표 계산기(CoordinateMapper)는 double 을 받아서, 여기서 바꿔 넘긴다.
 * realtime 을 켰을 때만 이 클래스가 뜬다. (BE2 NearbyService 자체는 항상 떠 있어서 데모엔 영향 없음)
 */
@Component
@Profile("realtime")
@RequiredArgsConstructor
public class NeighborPortAdapter implements NeighborPort {

	private final NearbyService nearbyService;

	@Override
	public List<NeighborSong> anchorAndNeighbors(long anchorMusicId) {
		// BE2한테 "이 곡 주변 곡 찾아줘" 시킨다. 내 곡 정보(center) + 비슷한 곡들(neighbors)이 온다.
		NearbyResponse res = nearbyService.findNearby(anchorMusicId);

		List<NeighborSong> out = new ArrayList<>();
		// 맨 앞에 내 곡부터 넣는다 — 나랑 가장 가까우니까 거리 0.
		NearbyCenter c = res.center();
		out.add(new NeighborSong(c.id(), c.title(), c.artist(), toDouble(c.location()), 0.0));
		// 그다음 비슷한 곡들을 가까운 순서 그대로 넣는다.
		for (NeighborTrack n : res.neighbors()) {
			MusicSummary m = n.music();
			out.add(new NeighborSong(m.id(), m.title(), m.artist(), toDouble(m.location()), n.distance()));
		}
		return out;
	}

	/** BE2가 주는 곡 좌표(float 16개)를 우리 좌표 계산기가 받는 double 16개로 바꾼다. */
	private static double[] toDouble(Location loc) {
		float[] f = loc.toArray();
		double[] d = new double[f.length];
		for (int i = 0; i < f.length; i++) {
			d[i] = f[i];
		}
		return d;
	}
}
