package com.ssafy.backend.realtime.nearby.dto;

import java.util.List;

/**
 * 주변사람 버튼을 누르면 돌려주는 목록 (POST /api/realtime/nearby 응답).
 * 내가 지금 듣는 곡 + 그 곡이랑 비슷한 곡들을, 각 곡을 "지금 그 곡을 듣고 있는 사람들"로 묶어서 담는다.
 * 이건 버튼 누른 순간의 전체 목록만 준다. 이후에 사람이 들어오고 나가는 변화는 소켓으로 따로 온다(T2).
 */
public record NearbySnapshot(long anchorMusicId, List<NearbyGroup> groups) {
}
