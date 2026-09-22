package com.ssafy.backend.realtime.dto.nearby;

/**
 * S→C NEARBY_RIDER_COUNT — 주변사람 목록에 있는 누군가의 따라오는 인원수가 바뀌었다.
 *
 * 곡도 자리도 그대로라 목록에서 옮길 것은 없다. 숫자만 바꾸면 된다.
 *
 * @param email 인원수가 바뀐 사람
 * @param riderCount 바뀐 뒤의 인원수
 * @param musicId 그 사람이 있는 곡
 */
public record NearbyRiderCount(String email, int riderCount, long musicId) {
}
