package com.ssafy.backend.realtime.nearby.dto;

import java.util.List;

/**
 * 주변사람 버튼을 누르면 돌려주는 목록 (POST /api/realtime/nearby 응답).
 * 내 곡과 비슷한 곡을 듣고 있는 사람들을, 곡 구분 없이 한 줄로 쭉 담는다(가까운 순).
 * 이건 버튼 누른 순간의 전체 목록만 준다. 이후에 사람이 들어오고 나가는 변화는 소켓으로 따로 온다(T2).
 */
public record NearbySnapshot(long anchorMusicId, List<NearbyPerson> people) {
}
